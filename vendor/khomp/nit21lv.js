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
    const axis_name = ['x', 'y', 'z'];

    data.device = [];
    data.sensors = [];

    let model = { n: 'model', u: 'string', v: 'Unknown model' };
    if (input.fPort == 13) {
        model.v = 'NIT 21LV';
    }
    else {
        return { data };
    }

    data.device.push(model);

    mask = (input.bytes[i++] << 8) | input.bytes[i++];

    // Firmware
    if (mask >> 0 & 0x01) {
        let firmware = { n: 'firmware_version' };
        firmware.v = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
        firmware.v += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
        data.device.push(firmware);
    }

    // Battery
    if (mask >> 1 & 0x01) {
        let battery = { n: 'battery', u: 'V' };
        battery.v = ((input.bytes[i++] / 100) + 1).toFixed(2);
        data.device.push(battery);
    }

    // Temperature Int
    if (mask >> 2 & 0x01) {
        let temperature = { n: 'temperature', u: 'C' };
        temperature.v = (input.bytes[i++] / 2).toFixed(1);
        data.sensors.push(temperature);
    }

    // Humidity Int
    if (mask >> 3 & 0x01) {
        let humidity = { n: 'humidity', u: '%' };
        humidity.v = (input.bytes[i++] / 2).toFixed(1);
        data.sensors.push(humidity);
    }

    // RMS
    if (mask >> 4 & 0x01) {
        for (let index = 0; index < 3; index++) {
            let rms = { u: 'ms2', n: 'rms_' + axis_name[index] };
            rms.v = (((input.bytes[i++] << 8) | input.bytes[i++]) / 1000.0).round(4);
            data.sensors.push(rms);
        }
    }

    // Kurtosis
    if (mask >> 5 & 0x01) {
        for (let index = 0; index < 3; index++) {
            let kurtosis = { u: 'ms2', n: 'kurtosis_' + axis_name[index] };
            kurtosis.v = (((input.bytes[i++] << 8) | input.bytes[i++]) / 1000.0).round(4);
            data.sensors.push(kurtosis);
        }
    }

    // Peak to Peak
    if (mask >> 6 & 0x01) {
        for (let index = 0; index < 3; index++) {
            let peak_to_peak = { u: 'ms2', n: 'peak_to_peak_' + axis_name[index] };
            peak_to_peak.v = (((input.bytes[i++] << 8) | input.bytes[i++]) / 1000.0).round(4);
            data.sensors.push(peak_to_peak);
        }
    }

    // Crest Factor
    if (mask >> 7 & 0x01) {
        for (let index = 0; index < 3; index++) {
            let crest_factor = { u: 'ms2', n: 'crest_factor_' + axis_name[index] };
            crest_factor.v = (((input.bytes[i++] << 8) | input.bytes[i++]) / 1000.0).round(4);
            data.sensors.push(crest_factor);
        }
    }

    return { data };
}

Number.prototype.round = function (n) {
    const d = Math.pow(10, n);
    return Math.round((this + Number.EPSILON) * d) / d;
}