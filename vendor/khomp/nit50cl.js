// Decode uplink function.
//
// Input is an object with the following fields:
// - bytes = Byte array containing the uplink payload, e.g. [255, 230, 255, 0]
// - fPort = Uplink fPort.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - data = Object representing the decoded payload.

const op_mode_str = [
    "disable",
    "dry",
    "counter",
    "dry with counter",
    "counter time",
    "dry with counter time",
    "counter and counter time",
    "dry with counter and counter time",
];

function decodeUplink(input) {
    let i = 0;
    let data_mask = 0;
    let data_mask_index = 0;
    let inputs_config = 0;
    let data = {};
    let decode_ver = input.bytes[i++];

    if (input.fPort == 0) {
        return { data };
    }

    if (decode_ver != 1) {
        return {
            errors: ['invalid decoder version'],
        };
    }

    if (input.fPort != 20) {
        return {
            errors: ['invalid fPort'],
        };
    }

    data.device = [];
    data.sensors = [];

    data.device.push({
        n: 'model',
        v: 'NIT 50CL'
    });

    // Extract the data mask
    data_mask = read_uint16(input.bytes.slice(i, i += 2));

    // Extract the inputs config
    inputs_config = read_uint16(input.bytes.slice(i, i += 2));

    // Firmware
    if (data_mask >> data_mask_index++ & 0x01) {
        let firmware = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
        firmware += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
        data.device.push({
            n: 'firmware_version',
            v: firmware
        });
    }

    // Power source
    data.sensors.push({
        n: 'power_source',
        v: (data_mask >> data_mask_index++ & 0x01) ? 'external' : 'battery'
    });

    // Battery
    if (data_mask >> data_mask_index++ & 0x01) {
        data.sensors.push({
            n: 'battery_voltage',
            v: ((input.bytes[i++] / 100.0) + 1).round(2),
            u: 'V'
        });
    }

    // FIFO buffer
    data.sensors.push({
        n: 'buffered_events',
        v: ((data_mask >> data_mask_index++) & 0x01) ? input.bytes[i++] : 0
    });

    // Uplink interval
    if (data_mask >> data_mask_index++ & 0x01) {
        data.sensors.push({
            n: 'uplink_interval',
            v: read_uint16(input.bytes.slice(i, i += 2)),
            u: 'minutes'
        });
    }

    // Debounce
    if (data_mask >> data_mask_index++ & 0x01) {
        data.sensors.push({
            n: 'debounce_time',
            v: read_uint16(input.bytes.slice(i, i += 2)) * 10,
            u: 'ms'
        });
    }


    // Inputs config
    for (let index = 0; index < 5; index++) {
        data.sensors.push({
            n: 'in' + (index + 1) + '_op_mode',
            v: op_mode_str[(inputs_config >> (index * 3) & 0x07)],
        });
    }

    // Inputs status mask
    if (data_mask >> data_mask_index++ & 0x01) {
        let inputs_status = input.bytes[i++] & 0x1F;
        for (let index = 0; index < 5; index++) {
            // Get input status
            // Check if the config is a dry or a dry with counter
            if (inputs_config >> (index * 3) & 0x01) {
                data.sensors.push({
                    n: 'in' + (index + 1),
                    v: (inputs_status >> index & 0x01) ? 'closed' : 'open',
                });
            }
        }
    }

    // PWM Duty
    if (data_mask >> data_mask_index++ & 0x01) {
        data.sensors.push({
            n: 'pwm_duty',
            v: input.bytes[i++],
            u: '%'
        });
    }

    // Enable FIFO event
    data.sensors.push({
        n: 'enable_fifo_event',
        v: (data_mask >> data_mask_index++ & 0x01) ? 'true' : 'false'
    });

    // Send at event
    data.sensors.push({
        n: 'send_at_event',
        v: (data_mask >> data_mask_index++ & 0x01) ? 'true' : 'false'
    });

    // Input Alarm
    let input_alarm = (data_mask >> data_mask_index++ & 0x01);
    data.sensors.push({
        n: 'input_alarm',
        v: input_alarm ? 'enabled' : 'disabled'
    });

    // Input alarm timeout
    data.sensors.push({
        n: 'input_alarm_timeout',
        v: input_alarm ? read_uint16(input.bytes.slice(i, i += 2)) : 'N/A',
        u: 'seconds'
    });

    // Get counters
    for (let index = 0; index < 5; index++) {
        // If the type of input is a counter
        if ((inputs_config >> (index * 3) & 0x02) != 0) {
            data.sensors.push({
                n: 'counter_in' + (index + 1),
                v: read_uint24(input.bytes.slice(i, i += 3)),
            });
        }
    }

    // Get counters time
    for (let index = 0; index < 5; index++) {
        // If the type of input is a counter time
        if ((inputs_config >> (index * 3) & 0x04) != 0) {
            data.sensors.push({
                n: 'counter_time_in' + (index + 1),
                v: read_uint24(input.bytes.slice(i, i += 3)),
                u: 'seconds'
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

function read_uint24(bytes) {
    let value = (bytes[0] << 16) + (bytes[1] << 8) + bytes[2];
    return value & 0xffffff;
}
