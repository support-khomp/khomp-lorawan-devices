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
    let i = 0;
    let data = {};
    let decode_ver = input.bytes[i++];

    data.device = [];
    data.sensors = [];

    let model = { n: 'model', u: 'string', v: 'Unknown model' };
    if (input.fPort == 10) {
        model.v = "ITE 11LI";
    }
    else {
        return { data };
    }

    data.device.push(model);

    mask = (input.bytes[i++] << 8) | input.bytes[i++];

    // Firmware    
    if (mask >> 0 & 0x01) {
        let firmware = { n: 'firmware_version', u: 'string' };
        firmware.v = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
        firmware.v += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
        data.device.push(firmware);
    }

    // Temperature
    if (mask >> 1 & 0x01) {
        let temperature = { n: 'temperature', u: 'C' };
        temperature.v = (input.bytes[i++] / 2).round(1);
        data.sensors.push(temperature);
    }

    // Frequency
    if (mask >> 2 & 0x01) {
        let frequency = { n: 'frequency', u: 'Hz' };
        frequency.v = ((input.bytes[i++] / 10.0) + 45).round(1);
        data.sensors.push(frequency);
    }

    const c1_state_name = ["OPEN", "CLOSED"];
    const phases_name = ["phase_a", "phase_b", "phase_c"];
    const tc_config_name = ["POWCT-T16-150-333", "POWCT-T24-250-333", "POWCT-T36-630-333", "POWCT-T50-1500-333", "POWCT-T16-25-333", "POWCT-T16-40-333", "POWCT-T16-100-333"];

    for (let index = 0; index < 3; index++) {
        if (mask >> (3 + index) & 0x01) {
            let voltage = { n: phases_name[index] + '_' + 'voltage', u: 'V' };
            let current = { n: phases_name[index] + '_' + 'current', u: 'A' };
            let pwr_factor = { n: phases_name[index] + '_' + 'pwr_factor', u: '/' };
            let active_energy = { n: phases_name[index] + '_' + 'active_energy', u: 'kWh' };
            let reactive_energy = { n: phases_name[index] + '_' + 'reactive_energy', u: 'kVArh' };
            let tc_config = { n: phases_name[index] + '_' + 'tc_config' };

            voltage.v = (((input.bytes[i++] << 8) | input.bytes[i++]) / 10.0).round(1);

            if (decode_ver == 1) {
                current.v = (((input.bytes[i++] << 8) | input.bytes[i++]) / 1000.0).round(3);
            }
            else {
                current.v = (((input.bytes[i++] << 8) | input.bytes[i++]) / 20.0).round(2);
            }

            pwr_factor.v = ((input.bytes[i++] / 100.0) - 1).round(2);

            active_energy.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
            active_energy.v = (active_energy.v / 100.0).round(2);

            reactive_energy.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
            reactive_energy.v = (reactive_energy.v / 100.0).round(2);

            tc_config.v = tc_config_name[input.bytes[i++]];

            data.sensors.push(voltage);
            data.sensors.push(current);
            data.sensors.push(pwr_factor);
            data.sensors.push(active_energy);
            data.sensors.push(reactive_energy);
            data.sensors.push(tc_config);
        }
    }

    // B1
    if (mask >> 6 & 0x01) {
        let b1_state = { n: 'b1_state', u: 'bool' };
        b1_state.v = c1_state_name[input.bytes[i++]];
        data.sensors.push(b1_state);
    }

    return { data };
}

Number.prototype.round = function (n) {
    const d = Math.pow(10, n);
    return Math.round((this + Number.EPSILON) * d) / d;
}
