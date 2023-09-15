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
    let timestamp = 0;

    const codec_version = 1;
    const max_time_drift = 60;
    const sensor_model = {
        1: 'logger',
        2: 'none',
        3: 'DS18B20',
        4: 'THW100',
        5: 'THW101'
    };

    if (input.fPort < 1 || input.fPort > 5) {
        return { data };
    }

    const device_codec_version = input.bytes[i++];
    if (device_codec_version != codec_version) {
        return {
            errors: ['invalid codec version'],
        };
    }

    data.device = [];
    data.sensors = [];

    data.device.push({
        n: 'payload_type',
        v: input.fPort == 1 ? 'logger' : 'regular'
    });

    if (input.fPort != 1) {
        data.sensors.push({
            n: 'sensor_model',
            v: sensor_model[input.fPort]
        });

        // Mask
        let mask = input.bytes[i++];
        let mask_index = 0;
        let now = (input.recvTime / 1000).round(0);

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
        data.device.push({
            n: 'power_source',
            v: (mask >> mask_index++ & 0x01) ? 'external' : 'battery',
        });

        // Battery
        if (mask >> mask_index++ & 0x01) {
            data.device.push({
                n: 'battery_voltage',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 1000).round(3),
                u: 'V'
            });
        }

        // Temperature
        if (sensor_model[input.fPort] != 'none') {
            // Temperature
            let temperature = read_int16(input.bytes.slice(i, i += 2));
            if (temperature != 0xFFFF) {
                data.sensors.push({
                    n: 'temperature',
                    v: (temperature / 10.0).round(1),
                    u: '°C',
                    bt: now
                });
            }
        }

        // humidity   
        if (sensor_model[input.fPort] == 'THW100' || sensor_model[input.fPort] == 'THW101') {
            // humidity
            let humidity = read_uint16(input.bytes.slice(i, i += 2));
            if (humidity != 0xFFFF) {
                data.sensors.push({
                    n: 'humidity',
                    v: (humidity / 10.0).round(1),
                    u: 'RH %',
                    bt: now
                });
            }
        }

        // C1
        if (mask >> mask_index++ & 0x01) {
            let c1_control = input.bytes[i++];
            data.sensors.push({
                n: 'c1_status',
                v: (c1_control & 0x01) ? 'closed' : 'open',
            });

            if (c1_control & 0x02) {
                data.sensors.push({
                    n: 'c1_counter',
                    v: read_uint24(input.bytes.slice(i, i += 3))
                });
            }
        }

        // Number of samples stored
        let samples_stored = 0;
        if (mask >> mask_index++ & 0x01) {
            samples_stored = read_uint16(input.bytes.slice(i, i += 2));
        }

        data.sensors.push({
            n: 'samples_stored',
            v: samples_stored,
        });

        // Max time drift
        if (mask >> mask_index++ & 0x01) {
            timestamp = read_uint32(input.bytes.slice(i, i += 4));
            if ((timestamp > (now + max_time_drift)) || (timestamp < (now - max_time_drift))) {
                data.sensors.push({
                    n: 'time_drift',
                    v: (timestamp - now).round(0),
                    u: 's',
                });
            }
        }
    }
    else {
        // Data Logger 
        while (i < input.bytes.length) {
            timestamp = read_uint32(input.bytes.slice(i, i += 4));

            // Temperature
            let temperature = read_int16(input.bytes.slice(i, i += 2));
            if (temperature != 0xFFFF) {
                data.sensors.push({
                    n: 'temperature',
                    v: (temperature / 10.0).round(1),
                    u: '°C',
                    bt: timestamp
                });
            }

            // humidity
            let humidity = read_uint16(input.bytes.slice(i, i += 2));
            if (humidity != 0xFFFF) {
                data.sensors.push({
                    n: 'humidity',
                    v: (humidity / 10.0).round(1),
                    u: 'RH %',
                    bt: timestamp
                });
            }
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

function read_int16(bytes) {
    let value = (bytes[0] << 8) + bytes[1];
    if (value != 0xFFFF) {
        if (value & 0xf000) {
            value ^= 0xffff;
            value += 1;
            value *= -1;
        }
    }
    return value;
}

function read_uint24(bytes) {
    let value = (bytes[0] << 16) + (bytes[1] << 8) + bytes[2];
    return value & 0xffffff;
}

function read_uint32(bytes) {
    let value = (bytes[0] << 24) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
    return value & 0xffffffff;
}