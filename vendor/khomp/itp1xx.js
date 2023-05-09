/**
* Decode an uplink message from a buffer (array) of bytes to an object of fields.
* If use ChirpStack, rename the function to "function Decode(port, bytes, variables)"
*/

const model_name = { 5: 'ITP 100', 8: 'ITP 111' };
const op_mode_name = ["manual", "automatic", "slot", "error"];

function decodeUplink(input) {
    let data = {};
    let i = 0;

    data.device = [];
    data.sensors = [];
    data.status = [];

    data.device.push({
        n: 'model',
        v: model_name[input.fPort]
    });

    if (input.bytes[i++] == 0x4C && input.bytes[i++] == 0x01) {
        let firmware = (input.bytes[3] & 0x0F) + '.' + (input.bytes[3] >> 4 & 0x0F) + '.';
        firmware += (input.bytes[2] & 0x0F) + '.' + (input.bytes[2] >> 4 & 0x0F);
        data.device.push({
            n: 'firmware_version',
            v: firmware
        });

        i = 4;
        sensor_mask = (input.bytes[i++] << 24) + (input.bytes[i++] << 16) + (input.bytes[i++] << 8) + input.bytes[i++];

        if (sensor_mask >> 0 & 0x01) {
            data.sensors.push({
                n: 'voltage',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 10.0).round(1),
                u: 'V'
            });
        }

        if (sensor_mask >> 1 & 0x01) {
            data.sensors.push({
                n: 'current',
                v: (read_uint24(input.bytes.slice(i, i += 3)) / 10000.0).round(3),
                u: 'A'
            });
        }

        if (sensor_mask >> 2 & 0x01) {
            data.sensors.push({
                n: 'pwr_factor',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 1000.0).round(3),
                u: '/'
            });
        }

        if (sensor_mask >> 3 & 0x01) {
            data.sensors.push({
                n: 'frequency',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 1000.0).round(3),
                u: 'Hz'
            });
        }

        if (sensor_mask >> 4 & 0x01) {
            data.sensors.push({
                n: 'temperature',
                v: ((read_uint16(input.bytes.slice(i, i += 2)) / 100.0) - 273.15).round(2),
                u: 'C'
            });
        }

        if (sensor_mask >> 5 & 0x01) {
            data.sensors.push({
                n: 'ambient_light',
                v: read_uint16(input.bytes.slice(i, i += 2)),
                u: 'lux'
            });
        }

        if (sensor_mask >> 6 & 0x01) {
            data.sensors.push({
                n: 'angle',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 100.0).round(2),
                u: 'degree'
            });
        }

        if (sensor_mask >> 7 & 0x01) {
            data.sensors.push({
                n: 'swing_duty',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 100.0).round(2),
                u: '%'
            });
        }

        if (sensor_mask >> 8 & 0x01) {
            data.sensors.push({
                n: 'standard_deviation',
                v: (read_uint16(input.bytes.slice(i, i += 2)) / 100.0).round(2),
                u: '%'
            });
        }

        if (sensor_mask >> 9 & 0x01) {
            data.sensors.push({
                n: 'active_energy',
                v: (input.bytes[i++] << 56 | input.bytes[i++] << 48 | input.bytes[i++] << 40 | input.bytes[i++] << 32 | input.bytes[i++] << 24 | input.bytes[i++] << 16 | input.bytes[i++] << 8) / 1000000.0,
                u: 'kWh'
            });
        }

        if (sensor_mask >> 10 & 0x01) {
            data.sensors.push({
                n: 'reactive_energy',
                v: (input.bytes[i++] << 56 | input.bytes[i++] << 48 | input.bytes[i++] << 40 | input.bytes[i++] << 32 | input.bytes[i++] << 24 | input.bytes[i++] << 16 | input.bytes[i++] << 8) / 1000000.0,
                u: 'kVArh'
            });
        }


        if (sensor_mask >> 11 & 0x01) {
            let latitude = read_uint32(input.bytes.slice(i, i += 4));
            let longitude = read_uint32(input.bytes.slice(i, i += 4))

            if (latitude >> 31 & 0x01) {
                latitude = latitude & 0x7FFFFFFF;
                latitude = - (latitude / 1000000.0);
            }
            else {
                latitude = (latitude / 1000000.0);
            }

            if (longitude >> 31 & 0x01) {
                longitude = longitude & 0x7FFFFFFF;
                longitude = - (longitude / 1000000.0);
            }
            else {
                longitude = - (longitude / 1000000.0);
            }

            data.sensors.push({
                n: 'latitude',
                v: latitude,
                u: 'DD'
            });

            data.sensors.push({
                n: 'longitude',
                v: longitude,
                u: 'DD'
            });

        }

        if (sensor_mask >> 12 & 0x01) {
            data.status.push({
                n: 'dimmer',
                v: input.bytes[i++],
                u: '%'
            });
        }

        if (sensor_mask >> 13 & 0x01) {
            data.status.push({
                n: 'last_commutation',
                v: read_uint16(input.bytes.slice(i, i += 2)),
                u: 'sec'
            });
        }

        data.status.push({
            n: 'light_state',
            v: (sensor_mask >> 14 & 0x01) ? 'on' : 'off'
        });

        data.status.push({
            n: 'operation_mode',
            v: op_mode_name[(sensor_mask >> 16 & 0x03)]
        });

        data.status.push({
            n: 'rtc',
            v: (sensor_mask >> 18 & 0x01) ? 'syncronized' : 'not syncronized'
        });


        if (sensor_mask >> 19 & 0x01) {
            data.status.push({
                n: 'timestamp',
                v: read_uint32(input.bytes.slice(i, i += 4)),
                u: 'sec',
            });
        }


        if ((sensor_mask >> 20 & 0x03) > 2) {
            data.status.push({
                n: 'slot_running',
                v: 'none'
            });
        }
        else {
            data.status.push({
                n: 'slot_running',
                v: (sensor_mask >> 20 & 0x03)
            });
        }


        return { data };
    }

    else if (input.bytes[0] == 0x4B && input.bytes[1] == 0x02) {
        data.status.push({
            n: 'alarm_message',
            v: 'TILT Alarm Event!'
        });

        return { data };
    }

    else if (input.bytes[0] == 0x4B && input.bytes[1] == 0x03) {
        data.status.push({
            n: 'alarm_message',
            v: 'Power Alarm Event!'
        });

        return { data };
    }

    else if (input.bytes[0] == 0x4B && input.bytes[1] == 0x04) {
        let error_message = 'Report Alarm Event! ';

        if (input.bytes[2] >> 0 & 0x01) {
            error_message += 'Power Meter FAIL ';
        }

        if (input.bytes[2] >> 1 & 0x01) {
            error_message += 'Lux Sensor FAIL ';
        }

        if (input.bytes[2] >> 2 & 0x01) {
            error_message += 'GPS Sensor FAIL ';
        }

        if (input.bytes[2] >> 3 & 0x01) {
            error_message += 'Accelerometer Sensor FAIL';
        }

        data.status.push({
            n: 'error_message',
            v: error_message
        });

        return { data };
    }

    else if (input.bytes[0] == 0x4B && input.bytes[1] == 0x05) {

        data.status.push({
            n: 'light_state',
            v: (input.bytes[2] & 0x01) ? 'on' : 'off'
        });

        data.status.push({
            n: 'event_time',
            v: read_uint32(input.bytes.slice(3, 7)),
            u: 'sec',
        });

        return { data };
    }
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