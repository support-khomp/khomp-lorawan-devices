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
    var device = {};
    var bytes = input.bytes;
    var port = input.fPort;

    data.device = []; // vector to keep data after treatment
    data.sensor = []; // vector to keep data after treatment

    var model = {};
    model.n = 'model';
    model.u = 'string';
    switch (port) {
        //LoRaWAN port communication for ITC 100
        case 9:
            model.v = "ITC100";
            break;
        default:
            model.v = "unknow_model";
            return { data };
    }
    data.device.push(model);

    // OPERATION MODE
    var mode = {};
    mode.n = 'mode';
    mode.u = 'string';
    if (bytes[i++] === 0x4A) {
        mode.v = 'multi_mode';
    }
    else if (bytes[i] == 0x4B) {
        mode.v = 'digital_reflux_mode';
    }
    else {
        mode.v = 'single_mode';
    }
    data.device.push(mode);

    // BIT STATUS
    // Message type
    var message = {};
    message.n = 'message';
    message.u = 'string';
    if ((bytes[i] >> 6) === 0x00) // 00
    {
        message.v = 'normal_report';
    } else if ((bytes[i] >> 6) === 0x01) // 01
    {
        message.v = 'fraud_report';
    } else if ((bytes[i] >> 6) === 0x02) // 10
    {
        message.v = 'tamper_fraud_report';
    } else if ((bytes[i] >> 6) === 0x03) // 11
    {
        message.v = 'ack_configuration';
    }
    data.sensor.push(message);

    // Fraud detection
    var fraud = {};
    fraud.n = 'fraud';
    fraud.u = 'string';
    if (((bytes[i] >> 5) & 0x01) === 0x00) {
        fraud.v = 'no_fraud';
    } else {
        fraud.v = 'fraud_detected';
    }
    data.sensor.push(fraud);

    // Tamper Fraud detection
    var tamper = {};
    tamper.n = 'tamper';
    tamper.u = 'string';
    if (((bytes[i] >> 4) & 0x01) === 0x00) {
        tamper.v = 'tamper_closed';
    } else {
        tamper.v = 'tamper_open';
    }
    data.sensor.push(tamper);

    // Resolution
    var resol = {};
    resol.u = 'l';
    resol.n = 'L/pulse';
    if (((bytes[i] >> 1) & 0x03) === 0x00) {
        resol.n = 'count_resolution_not_configured';
        resol.v = '';
    } else if (((bytes[i] >> 1) & 0x03) === 0x01) {
        resol.v = 1.0;
    } else if (((bytes[i] >> 1) & 0x03) === 0x02) {
        resol.v = 10.0;
    } else if (((bytes[i] >> 1) & 0x03) === 0x03) {
        resol.v = 100.0;
    } else if (((bytes[i] >> 1) & 0x03) === 0x04) {
        resol.v = 1000.0;
    } else if (((bytes[i] >> 1) & 0x03) === 0x05) {
        resol.v = 10000.0;
    }
    data.sensor.push(resol);
    i++;

    // BATTERY
    var voltage = {};
    voltage.n = 'battery';
    voltage.v = (bytes[i++] / 10.0);
    voltage.u = 'V';
    data.sensor.push(voltage);

    // FIRMWARE
    var conv = parseInt(((bytes[i++] << 8) | bytes[i++]));
    var firmware = {};
    firmware.n = 'firmware';
    firmware.u = 'string';
    firmware.v = (conv / 1000).toFixed(0) + '.' + ((conv % 1000) / 100).toFixed(0) + '.' + ((conv % 100) / 10).toFixed(0) + '.' + ((conv % 10)).toFixed(0);
    data.device.push(firmware);

    // FLUX A
    var pulse_count_flux_a = {};
    pulse_count_flux_a.n = 'pulse_count_flux_a';
    pulse_count_flux_a.v = (bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | (bytes[i++]);
    pulse_count_flux_a.u = 'count';
    data.sensor.push(pulse_count_flux_a);

    if (device.mode === 'multi_mode') {
        // FLUX B
        var pulse_count_flux_b = {};
        pulse_count_flux_b.n = 'pulse_count_flux_b';
        pulse_count_flux_b.v = (bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | (bytes[i++]);
        pulse_count_flux_b.u = 'count';
        data.sensor.push(pulse_count_flux_b);

        // FLUX C
        var pulse_count_flux_c = {};
        pulse_count_flux_c.n = 'pulse_count_flux_c';
        pulse_count_flux_c.v = (bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | (bytes[i]);
        pulse_count_flux_c.u = 'count';
        data.sensor.push(pulse_count_flux_c);

    } else {
        var pulse_count_reflux = {};
        pulse_count_reflux.n = 'pulse_count_reflux';
        pulse_count_reflux.v = (bytes[i++] << 8) | (bytes[i]);
        pulse_count_reflux.u = 'count';
        data.sensor.push(pulse_count_reflux);
    }

    return { data };
}
