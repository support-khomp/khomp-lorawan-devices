// Decode uplink function.
//
// Input is an object with the following fields:
// - bytes = Byte array containing the uplink payload, e.g. [255, 230, 255, 0]
// - fPort = Uplink fPort.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - data = Object representing the decoded payload.
const axis_name = ['x', 'y', 'z'];

function decodeUplink(input) {
    let i = 0;
    let mask = 0;
    let mask_index = 0;
    let data = {};
    let decode_ver = input.bytes[i++];

    data.device = [];
    data.sensors = [];

    if (decode_ver != 1) {
        return {
            errors: ['invalid decoder version'],
        };
    }

    if (input.fPort != 13) {
        return {
            errors: ['invalid fPort'],
        };
    }

    data.device.push({
        n: 'model',
        v: 'NIT 21LV'
    });

    mask = (input.bytes[i++] << 8) | input.bytes[i++];

    // Firmware
    if (mask >> mask_index++ & 0x01) {
        let firmware = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
        firmware += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
        data.device.push({
            n: 'firmware_version',
            v: firmware
        });
    }

    // Battery
    if (mask >> mask_index++ & 0x01) {
        data.device.push({
            n: 'battery',
            v: ((input.bytes[i++] / 120) + 1).round(2),
            u: 'V'
        });
    }

    // Temperature Int
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'internal_temperature',
            v: (input.bytes[i++] / 3).round(1),
            u: '°C'
        });
    }

    // Humidity Int
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'internal_relative_humidity',
            v: (input.bytes[i++] / 2).round(1),
            u: '% RH'
        });
    }

    // RMS
    if (mask >> mask_index++ & 0x01) {
        for (let index = 0; index < 3; index++) {
            data.sensors.push({
                u: 'm/s²',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 10000.0).round(4),
                n: 'rms_' + axis_name[index]
            });
        }
    }

    // Kurtosis
    if (mask >> mask_index++ & 0x01) {
        for (let index = 0; index < 3; index++) {
            data.sensors.push({
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 10000.0).round(4),
                n: 'kurtosis_' + axis_name[index]
            });
        }
    }

    // Peak to Peak
    if (mask >> mask_index++ & 0x01) {
        for (let index = 0; index < 3; index++) {
            data.sensors.push({
                u: 'm/s²',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 10000.0).round(4),
                n: 'peak_to_peak_' + axis_name[index]
            });
        }
    }

    // Crest Factor
    if (mask >> mask_index++ & 0x01) {
        for (let index = 0; index < 3; index++) {
            data.sensors.push({
                u: 'dB',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 100.0).round(2),
                n: 'crest_factor_' + axis_name[index]
            });
        }
    }

    // Calibrated
    data.sensors.push({
        n: 'calibrated',
        v: (mask >> mask_index++ & 0x01) ? 'true' : 'false',
        u: 'bool'
    });

    // Threshold event
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'threshold_event',
            v: 'event'
        });
    }

    // Velocity
    if (mask >> mask_index++ & 0x01) {
        for (let index = 0; index < 3; index++) {
            data.sensors.push({
                u: 'm/s',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 100000.0).round(5),
                n: 'velocity_' + axis_name[index]
            });
        }
    }

    return { data };
}

Number.prototype.round = function (n) {
    const d = Math.pow(10, n);
    return Math.round((this + Number.EPSILON) * d) / d;
}

function read_uint16(bytes) {
    let value = (bytes[0] << 8) + bytes[1];
    return value & 0xffff;
}
