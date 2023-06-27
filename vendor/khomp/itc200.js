// Decode uplink function.
//
// Input is an object with the following fields:
// - bytes = Byte array containing the uplink payload, e.g. [255, 230, 255, 0]
// - fPort = Uplink fPort.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - data = Object representing the decoded payload.

const model_name = {
    16: 'ITC 201',
    17: 'ITC 204',
    18: 'ITC 211',
    19: 'ITC 214'
};
const meter_name = [
    'a',
    'b',
    'c',
    'd'];
const counter_name = [
    'flux_a',
    'flux_b',
    'flux_c',
    'flux_d',
    'reflux_a',
    'reflux_b'];
const op_mode_name = [
    'Single flux',
    'Single flux and reflux',
    'Single flux and reflux digital',
    'Single flux and reflux quadrature',
    'Dual flux',
    'Dual flux and reflux',
    'Dual flux and reflux digital',
    'Dual flux and reflux quadrature',
    'Triple flux',
    'Quad flux'];

function decodeUplink(input) {
    let i = 0;
    let mask = 0;
    let mask_index = 0;
    let data = {};
    let decode_ver = input.bytes[i++];
    let resolution = 0;

    if (decode_ver != 1) {
        return {
            errors: ['invalid decoder version'],
        };
    }

    if (input.fPort < 16 || input.fPort > 19) {
        return {
            errors: ['invalid fPort'],
        };
    }

    data.device = [];
    data.sensors = [];

    data.device.push({
        n: 'model',
        v: model_name[input.fPort]
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

    // battery
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'battery_voltage',
            v: ((input.bytes[i++] / 100.0) + 1).round(2),
            u: 'V'
        });
    }

    // Temperature
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'internal_temperature',
            v: (input.bytes[i++] / 2.0).round(1),
            u: '°C'
        });
    }

    // Humidity
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'internal_relative_humidity',
            v: (input.bytes[i++] / 2.0).round(1),
            u: '%RH'
        });
    }

    // operation_mode
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'operation_mode',
            v: op_mode_name[input.bytes[i++]]
        });
    }

    // resolution
    if (mask >> mask_index++ & 0x01) {
        resolution = Math.pow(10, input.bytes[i++]);
        data.sensors.push({
            n: 'resolution',
            v: resolution,
            u: 'L/pulse'
        });
    }

    // fraud_bit
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'fraud',
            v: 'detected'
        });
    }

    // Jump
    let pulse_width_active = ((mask >> mask_index++) & 0x01);

    // Counters Flux & Pulse Width   
    let counter_flux = [-1, -1, -1, -1];
    for (var index = 0; index < 4; index++) {
        // Counters Flux 
        if (mask >> mask_index++ & 0x01) {
            counter_flux[index] = read_uint32(input.bytes.slice(i, i += 4));
            data.sensors.push({
                n: 'counter_' + counter_name[index],
                v: counter_flux[index],
                u: 'counter'
            });

            // Pulse width
            if (pulse_width_active != 0) {
                data.sensors.push({
                    n: 'pulse_width_flux_' + meter_name[index],
                    v: read_uint16(input.bytes.slice(i, i += 2)) * 10,
                    u: 'ms'
                });
            }
        }
    }

    // Counters Reflux   
    let counter_reflux = [0, 0, 0, 0];
    for (var index = 0; index < 2; index++) {
        if (mask >> mask_index++ & 0x01) {
            counter_reflux[index] = read_uint32(input.bytes.slice(i, i += 4)),
                data.sensors.push({
                    n: 'counter_' + counter_name[index + 4],
                    v: counter_reflux[index],
                    u: 'counter'
                });
        }
    }

    // Total Volume
    if (resolution != 0) {
        for (var index = 0; index < 4; index++) {
            if (counter_flux[index] >= 0) {
                let total_volume = (counter_flux[index] - counter_reflux[index]) * resolution;
                data.sensors.push({
                    n: 'total_volume_meter_' + meter_name[index],
                    v: (total_volume / 1000.0).round(3),
                    u: 'm³'
                });
            }
        }
    }

    // Timestamp sync
    data.sensors.push({
        n: 'timestamp_sync',
        v: (mask >> mask_index++ & 0x01) ? 'syncronized' : 'not syncronized'
    });

    // Counter insert alarm    
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'counter_insert',
            v: 'alarm'
        });
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