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
    "dry with counter"];

function decodeUplink(input) {
    let i = 0;
    let mask = 0;
    let mask_index = 0;
    let data = {};
    let decode_ver = input.bytes[i++];

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

    mask = read_uint16(input.bytes.slice(i, i += 2));



    // Firmware
    if (mask >> mask_index++ & 0x01) {
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
        v: (mask >> mask_index++ & 0x01) ? 'external' : 'battery'
    });

    // battery
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'battery_voltage',
            v: ((input.bytes[i++] / 100.0) + 1).round(2),
            u: 'V'
        });
    }

    // Extract the mask inputs config
    let mask_inputs_config = mask >> 3 & 0x3FF;

    // Extract the mask inputs config
    for (let index = 0; index < 5; index++) {
        data.sensors.push({
            n: 'in' + (index + 1) + '_op_mode',
            v: op_mode_str[(mask_inputs_config >> (index * 2) & 0x03)],
        });
    }

    // Inputs status mask
    if (mask >> mask_index++ & 0x01) {
        let mask_inputs_status = input.bytes[i++] & 0x1F;
        for (let index = 0; index < 5; index++) {
            // Get input status
            // Check if the config is a dry or a dry with counter
            if (mask_inputs_config >> (index * 2) & 0x01) {
                data.sensors.push({
                    n: 'in' + (index + 1),
                    v: (mask_inputs_status >> index & 0x01) ? 'closed' : 'open',
                });
            }
        }
    }

    // Get counters
    for (let index = 0; index < 5; index++) {
        // If the type of input is a counter
        if ((mask_inputs_config >> (index * 2) & 0x02) != 0) {
            data.sensors.push({
                n: 'counter_in' + (index + 1),
                v: read_uint32(input.bytes.slice(i, i += 4)),
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

function read_uint32(bytes) {
    let value = (bytes[0] << 24) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
    return value & 0xffffffff;
}