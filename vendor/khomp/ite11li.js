// Decode uplink function.
//
// Input is an object with the following fields:
// - bytes = Byte array containing the uplink payload, e.g. [255, 230, 255, 0]
// - fPort = Uplink fPort.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - data = Object representing the decoded payload.
function decodeUplink(input) {
    var i = 0;
    var data = {};
    var bytes = input.bytes;
    var port = input.fPort;
    var decode_ver = bytes[i++];

    data.device = [];
    data.sensors = [];

    var model = {};
    model.n = 'model';
    model.u = 'string';
    switch (port) {
        case 10: model.v = "ITE 11LI"; break;
        default: model.v = "Unknow Model"; return { data };
    }

    data.device.push(model);

    mask = (bytes[i++] << 8) | bytes[i++];

    // Firmware
    var firmware = {};
    firmware.n = "firmware_version";
    firmware.u = 'string';
    if (mask >> 0 & 0x01) {
        firmware.v = (bytes[i] >> 4 & 0x0F) + '.' + (bytes[i++] & 0x0F) + '.';
        firmware.v += (bytes[i] >> 4 & 0x0F) + '.' + (bytes[i++] & 0x0F);
        data.device.push(firmware);
    }

    // Temperature
    if (mask >> 1 & 0x01) {
        var temperature = {};
        temperature.n = 'temperature';
        temperature.v = (bytes[i++] / 2).toFixed(1);
        temperature.u = 'C';
        data.sensors.push(temperature);
    }

    // Frequency
    if (mask >> 2 & 0x01) {
        var frequency = {};
        frequency.n = 'frequency';
        frequency.v = ((bytes[i++] / 10.0) + 45).toFixed(1);
        frequency.u = 'Hz';
        data.sensors.push(frequency);
    }

    var c1_state_name = ["OPEN", "CLOSED"];
    var phases_name = ["phase_a", "phase_b", "phase_c"];
    var tc_config_name = ["POWCT-T16-150-333", "POWCT-T24-250-333", "POWCT-T36-630-333", "POWCT-T50-1500-333", "POWCT-T16-25-333", "POWCT-T16-40-333", "POWCT-T16-100-333"];

    for (var index = 0; index < 3; index++) {
        if (mask >> (3 + index) & 0x01) {
            var voltage = {};
            var current = {};
            var pwr_factor = {};
            var active_energy = {};
            var reactive_energy = {};
            var tc_config = {};

            voltage.n = phases_name[index] + '_' + 'voltage';
            voltage.v = (((bytes[i++] << 8) | bytes[i++]) / 10.0).toFixed(1);
            voltage.u = 'V';
            data.sensors.push(voltage);

            current.n = phases_name[index] + '_' + 'current';
            if (decode_ver == 1) {
                current.v = (((bytes[i++] << 8) | bytes[i++]) / 1000.0).toFixed(3);
            }
            else {
                current.v = (((bytes[i++] << 8) | bytes[i++]) / 20.0).toFixed(2);
            }
            current.u = 'A';
            data.sensors.push(current);

            pwr_factor.n = phases_name[index] + '_' + 'pwr_factor';
            pwr_factor.v = ((bytes[i++] / 100.0) - 1).toFixed(2);
            pwr_factor.u = '/';
            data.sensors.push(pwr_factor);

            active_energy.n = phases_name[index] + '_' + 'active_energy';
            active_energy.v = ((bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | bytes[i++]);
            active_energy.v = (active_energy.v / 100.0).toFixed(2);
            active_energy.u = 'kWh';
            data.sensors.push(active_energy);

            reactive_energy.n = phases_name[index] + '_' + 'reactive_energy';
            reactive_energy.v = ((bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | bytes[i++]);
            reactive_energy.v = (reactive_energy.v / 100.0).toFixed(2);
            reactive_energy.u = 'kWh';
            data.sensors.push(reactive_energy);

            tc_config.n = phases_name[index] + '_' + 'tc_config';
            tc_config.v = tc_config_name[bytes[i++]];
            data.sensors.push(tc_config);
        }
    }

    // B1
    if (mask >> 6 & 0x01) {
        var b1_state = {};
        b1_state.n = 'b1_state';
        b1_state.v = c1_state_name[bytes[i++]];
        b1_state.u = 'bool';

        data.sensors.push(b1_state);
    }

    return { data };
}
