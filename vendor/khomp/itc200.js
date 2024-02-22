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
    let meter_resolution = 0;

    if (input.fPort == 0) {
        return { data };
    }

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

    mask = read_uint24(input.bytes.slice(i, i += 3));

    // Firmware
    if (mask >> mask_index++ & 0x01) {
        let firmware = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
        firmware += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
        data.device.push({
            n: 'firmware_version',
            v: firmware
        });
    }

    // Uplink interval
    if (mask >> mask_index++ & 0x01) {
        data.device.push({
            n: 'uplink_interval',
            v: read_uint16(input.bytes.slice(i, i += 2)),
            u: 'minutes'
        });
    }

    // Battery
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

    // Operation mode
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'operation_mode',
            v: op_mode_name[input.bytes[i++]]
        });
    }

    // Meter resolution
    if (mask >> mask_index++ & 0x01) {
        meter_resolution = Math.pow(10, input.bytes[i++]);
        data.sensors.push({
            n: 'meter_resolution',
            v: meter_resolution,
            u: 'L/pulse'
        });
    }

    // Fraud
    if (mask >> mask_index++ & 0x01) {
        data.sensors.push({
            n: 'fraud',
            v: 'detected'
        });
    }

    let pulse_width_active = ((mask >> mask_index++) & 0x01);

    // Counters Flux & Pulse Width   
    let counter_flux = [-1, -1, -1, -1];
    for (var index = 0; index < 4; index++) {
        // Counters Flux 
        if (mask >> mask_index++ & 0x01) {
            counter_flux[index] = read_uint32(input.bytes.slice(i, i += 4)),
                data.sensors.push({
                    n: 'counter_' + counter_name[index],
                    v: counter_flux[index]
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
                    v: counter_reflux[index]
                });
        }
    }

    // Total Volume
    if (meter_resolution != 0) {
        for (var index = 0; index < 4; index++) {
            if (counter_flux[index] >= 0) {
                let total_volume = (counter_flux[index] - counter_reflux[index]) * meter_resolution;
                data.sensors.push({
                    n: 'total_volume_meter_' + meter_name[index],
                    v: (total_volume / 1000.0).round(3),
                    u: 'm³'
                });
            }
        }
    }

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

function read_uint24(bytes) {
    let value = (bytes[0] << 16) + (bytes[1] << 8) + bytes[2];
    return value & 0xffffff;
}

function read_uint32(bytes) {
    let value = (bytes[0] << 24) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
    return value & 0xffffffff;
}
