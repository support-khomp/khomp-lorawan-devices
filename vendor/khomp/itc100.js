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

    if (input.fPort != 9) {
        return {
            errors: ['invalid fPort'],
        };
    }

    data.device = [];
    data.sensors = [];

    // Model
    data.device.push({
        n: 'model',
        v: 'ITC 100'
    });

    // OPERATION MODE
    const op_mode_str = {
        0x49: 'single_mode',
        0x4A: 'multi_mode',
        0x4B: 'digital_reflux_mode',
    };

    let mode = input.bytes[i++];

    data.sensors.push({
        n: 'operation_mode',
        v: op_mode_str[mode],
    });

    // BIT STATUS
    // Message type
    const msg_type_str = ['normal_report', 'fraud_report', 'tamper_fraud_report', 'ack_configuration'];

    data.sensors.push({
        n: 'message_type',
        v: msg_type_str[((input.bytes[i] >> 6) & 0x03)],
    });

    // Fraud detection
    data.sensors.push({
        n: 'fraud',
        v: ((input.bytes[i] >> 5) & 0x01) ? 'fraud_detected' : 'no_fraud',
    });

    // Tamper Fraud detection
    data.sensors.push({
        n: 'tamper',
        v: ((input.bytes[i] >> 4) & 0x01) ? 'tamper_open' : 'tamper_closed',
    });

    // Resolution
    let resolution = 'not_configured';

    let expo = (input.bytes[i++] >> 1 & 0x03);
    if (expo !== 0) {
        resolution = (10 ^ (expo - 1)).round(0);
    }

    data.sensors.push({
        n: 'resolution',
        u: 'L/pulse',
        v: resolution
    });

    // BATTERY
    data.sensors.push({
        n: 'battery_voltage',
        v: (input.bytes[i++] / 10.0).round(1),
        u: 'V'
    });

    // FIRMWARE
    let firmware = parseInt(((input.bytes[i++] << 8) | input.bytes[i++]));
    data.device.push({
        n: 'firmware_version',
        v: (firmware / 1000).toFixed(0) + '.'
            + ((firmware % 1000) / 100).toFixed(0) + '.'
            + ((firmware % 100) / 10).toFixed(0) + '.'
            + ((firmware % 10)).toFixed(0),
    });

    data.sensors.push({
        n: 'pulse_count_flux_a',
        v: read_uint32(input.bytes.slice(i, i += 4)),
    });

    if (op_mode_str[mode] === 'multi_mode') {
        // FLUX B
        data.sensors.push({
            n: 'pulse_count_flux_b',
            v: read_uint32(input.bytes.slice(i, i += 4)),
        });

        // FLUX C
        data.sensors.push({
            n: 'pulse_count_flux_c',
            v: read_uint32(input.bytes.slice(i, i += 4)),
        });

    } else {
        data.sensors.push({
            n: 'pulse_count_reflux',
            v: read_uint16(input.bytes.slice(i, i += 2)),
        });
    }

    return { data };
}

Number.prototype.round = function (n) {
    const d = Math.pow(10, n);
    return Math.round((this + Number.EPSILON) * d) / d;
};

function read_uint16(bytes) {
    let value = (bytes[0] << 8) + bytes[1];
    return value & 0xffff;
}

function read_uint32(bytes) {
    let value = (bytes[0] << 24) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
    return value & 0xffffffff;
}