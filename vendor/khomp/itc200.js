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
    let mask = 0;
    let mask_index = 0;
    let data = {};
    let decode_ver = input.bytes[i++];

    data.device = [];
    data.sensors = [];

    let model = { n: 'model', u: 'string' };
    switch (input.fPort) {
        case 16: model.v = "ITC 201"; break;
        case 17: model.v = "ITC 204"; break;
        case 18: model.v = "ITC 211"; break;
        case 19: model.v = "ITC 214"; break;
        default: model.v = "Unknown model"; return { data };
    }

    data.device.push(model);
    mask = (input.bytes[i++] << 8) | input.bytes[i++];

    // Firmware
    if (mask >> mask_index++ & 0x01) {
        let firmware = { n: 'firmware_version', u: 'string' };
        firmware.v = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
        firmware.v += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
        data.device.push(firmware);
    }

    // battery
    if (mask >> mask_index++ & 0x01) {
        let battery = { n: 'battery', u: 'V' };
        battery.v = ((input.bytes[i++] / 100.0) + 1).round(2);
        data.sensors.push(battery);
    }

    // Temperature
    if (mask >> mask_index++ & 0x01) {
        let temperature = { n: 'temperature', u: 'C' };
        temperature.v = (input.bytes[i++] / 2.0).round(1);
        data.sensors.push(temperature);
    }

    // Humidity
    if (mask >> mask_index++ & 0x01) {
        let humidity = { n: 'humidity', u: '%' };
        humidity.v = (input.bytes[i++] / 2.0).round(1);
        data.sensors.push(humidity);
    }

    // operation_mode
    if (mask >> mask_index++ & 0x01) {
        let operation_mode = { n: 'operation_mode', u: 'string' };
        const str_op_mode = ["Single flux",
            "Single flux and reflux",
            "Single flux and reflux digital",
            "Single flux and reflux quadrature",
            "Dual flux",
            "Dual flux and reflux",
            "Dual flux and reflux digital",
            "Dual flux and reflux quadrature",
            "Triple flux",
            "Quad flux"];
        operation_mode.v = str_op_mode[input.bytes[i++]];
        data.sensors.push(operation_mode);
    }

    if (decode_ver > 1) {
        // resolution
        if (mask >> mask_index++ & 0x01) {
            let resolution = { n: 'resolution', u: 'L/pulse' };
            const str_resolution = ["1", "10",
                "100", "1000", "10000"];
            resolution.v = str_resolution[input.bytes[i++]];
            data.sensors.push(resolution);
        }
    }

    // fraud_bit
    let fraud = { n: 'fraud', u: 'string' };
    if (mask >> mask_index++ & 0x01) {
        fraud.v = 'detected';
    }
    else {
        fraud.v = 'not detected';
    }

    data.sensors.push(fraud);

    // Counters
    const counter_name = ["flux_a", "flux_b", "flux_c", "flux_d", "reflux_a", "reflux_b"];
    for (var index = 0; index < 6; index++) {
        if (mask >> mask_index++ & 0x01) {
            let counter = { u: 'counter' };
            counter.n = 'counter_' + counter_name[index];
            counter.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
            data.sensors.push(counter);
        }
    }

    // Pulse width
    if (mask >> mask_index++ & 0x01) {
        let flux_in_use = (mask >> 7) & 0x0F;
        let flux_in_use_index = 0;
        const pulse_width_name = ["a", "b", "c", "d"];
        for (var index = 0; index < 4; index++) {
            if (flux_in_use >> flux_in_use_index++ & 0x01) {
                let pulse_width_flux = { u: 'ms/10' };
                pulse_width_flux.n = 'pulse_width_flux_' + pulse_width_name[flux_in_use_index - 1];
                pulse_width_flux.v = (input.bytes[i++] << 8) | input.bytes[i++];
                data.sensors.push(pulse_width_flux);
            }
        }
    }

    // timestamp_sync
    let timestamp_sync = { n: 'timestamp_sync', u: 'string' };
    if (mask >> mask_index++ & 0x01) {
        timestamp_sync.v = 'syncronized';
    }
    else {
        timestamp_sync.v = 'not syncronized';
    }
    data.sensors.push(timestamp_sync);

    // Counter insert alarm    
    if (mask >> mask_index++ & 0x01) {
        const counter_insert = { n: 'counter_insert', u: 'string', v: 'alarm' };
        data.sensors.push(counter_insert);
    }

    return { data };
}

Number.prototype.round = function (n) {
    const d = Math.pow(10, n);
    return Math.round((this + Number.EPSILON) * d) / d;
}