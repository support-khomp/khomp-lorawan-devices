// Decode uplink function.
//
// Input is an object with the following fields:
// - bytes = Byte array containing the uplink payload, e.g. [255, 230, 255, 0]
// - fPort = Uplink fPort.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - data = Object representing the decoded payload.

const model_name = { 14: 'ITP 200', 15: 'ITP 202' };
const op_mode_name = ["manual", "automatic", "slot", "sunriset"];
const error_names = ['power_meter_err', 'ambient_light_err', 'accelerometer_err', 'gps_err'];
const alert_names = ['pin_changed', 'over_current', 'under_voltage', 'over_voltage',
    'under_temperature', 'over_temperature', 'over_angle', 'soft_reset',
    'hard_reset', 'acc_energy_reset', 'poss_pwr_fail', 'no_load_detec',
    'pwr_alarm', 'max_relay_act'];

function decodeUplink(input) {
    let i = 0;
    let data = {};
    let mask_index = 0;
    let mask_status = 0;
    let mask_status_index = 0;
    let mask_sensor = 0;
    let mask_sensor_index = 0;
    let mask_alert = 0;
    let mask_error = 0;
    let decode_ver = input.bytes[i++];
    let mask = input.bytes[i++];

    if (decode_ver == 1) {
        data.device = [];
        data.device.push({
            n: 'model',
            v: model_name[input.fPort]
        });

        // Status mask
        if (mask >> mask_index++ & 0x01) {
            data.status = [];
            mask_status = read_uint16(input.bytes.slice(i, i += 2));
        }

        // Sensor mask
        if (mask >> mask_index++ & 0x01) {
            data.sensors = [];
            mask_sensor = read_uint16(input.bytes.slice(i, i += 2));
        }

        // Alert mask
        if (mask >> mask_index++ & 0x01) {
            data.alerts = [];
            mask_alert = read_uint16(input.bytes.slice(i, i += 2));
        }

        // Error mask
        if (mask >> mask_index++ & 0x01) {
            data.errors = [];
            mask_error = input.bytes[i++];
        }

        // Status mask input.bytes
        if (mask >> 0 & 0x01) {
            // Firmware
            if (mask_status >> mask_status_index++ & 0x01) {
                let firmware = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
                firmware += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
                data.device.push({
                    n: 'firmware_version',
                    v: firmware
                });
            }

            // Dimmer Duty
            if (mask_status >> mask_status_index++ & 0x01) {
                data.status.push({
                    n: 'dimmer',
                    v: input.bytes[i++],
                    u: '%'
                });
            }

            // Operation mode
            if (mask_status >> mask_status_index++ & 0x01) {
                data.status.push({
                    n: 'operation_mode',
                    v: op_mode_name[input.bytes[i++]]
                });
            }

            // Slot running
            if (mask_status >> mask_status_index++ & 0x01) {
                data.status.push({
                    n: 'slot_running',
                    v: input.bytes[i++]
                });
            }
            // Light state
            data.status.push({
                n: 'light_state',
                v: (mask_status >> mask_status_index++ & 0x01) ? 'on' : 'off'
            });

            // Relay Switching Counter
            if (mask_status >> mask_status_index++ & 0x01) {
                data.status.push({
                    n: 'relay_switching_counter',
                    v: read_uint32(input.bytes.slice(i, i += 4)),
                    u: 'counter'
                });
            }

            // Relay active time
            if (mask_status >> mask_status_index++ & 0x01) {
                data.status.push({
                    n: 'relay_active_time',
                    v: read_uint32(input.bytes.slice(i, i += 4)),
                    u: 'sec'
                });
            }

            // Coordinates fixed
            let coordinates_fixed = { n: 'coordinates_fixed', v: 'not_fixed' };
            if (mask_status >> mask_status_index++ & 0x01) {
                coordinates_fixed.v = 'fixed';
            }
            data.status.push(coordinates_fixed);

            // timestamp_sync
            let timestamp_sync = { n: 'timestamp_sync', v: 'not_syncronized' };
            if (mask_status >> mask_status_index++ & 0x01) {
                timestamp_sync.v = 'syncronized';
                // Timestamp
                if (mask_status >> mask_status_index++ & 0x01) {
                    data.status.push({
                        n: 'timestamp',
                        v: read_uint32(input.bytes.slice(i, i += 4)),
                        u: 'sec',
                    });
                }
            }
            else {
                mask_index++;
            }

            data.status.push(timestamp_sync);
        }

        // Sensor mask input.bytes
        if (mask >> 1 & 0x01) {
            // Temperature
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'temperature',
                    v: ((input.bytes[i++] / 2) - 15).round(1),
                    u: 'C'
                });
            }

            // Ambient Light
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'ambient_light',
                    v: read_uint16(input.bytes.slice(i, i += 2)),
                    u: 'lux'
                });
            }

            // Angle
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'angle',
                    v: (input.bytes[i++] / 2.5).round(1),
                    u: 'degree'
                });
            }

            // Frequency
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'frequency',
                    v: ((input.bytes[i++] / 10.0) + 45).round(1),
                    u: 'Hz'
                });
            }

            // Power Factor
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'pwr_factor',
                    v: ((input.bytes[i++] / 100.0) - 1).round(2),
                    u: '/'
                });
            }

            // Voltage
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'voltage',
                    v: (read_uint16(input.bytes.slice(i, i += 2)) / 10.0).round(1),
                    u: 'V'
                });
            }

            // Current
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'current',
                    v: (read_uint16(input.bytes.slice(i, i += 2)) / 1000.0).round(3),
                    u: 'A'
                });
            }

            // Active Energy
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'active_energy',
                    v: read_uint32(input.bytes.slice(i, i += 4)),
                    u: 'Wh'
                });
            }

            // Reactive Energy
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'reactive_energy',
                    v: read_uint32(input.bytes.slice(i, i += 4)),
                    u: 'VArh'
                });
            }

            // Coordinates
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                data.sensors.push({
                    n: 'latitude',
                    v: ((read_uint32(input.bytes.slice(i, i += 4)) / 1000000.0) - 90).round(6),
                    u: 'DD'
                });

                data.sensors.push({
                    n: 'longitude',
                    v: ((read_uint32(input.bytes.slice(i, i += 4)) / 1000000.0) - 180).round(6),
                    u: 'DD'
                });
            }
        }

        // Alerts mask
        if (mask >> 2 & 0x01) {
            for (let index = 0; index < 14; index++) {
                if (mask_alert >> index & 0x01) {
                    data.alerts.push({
                        n: alert_names[index],
                        v: 'alert'                            
                    });
                }
            }
        }

        // Error mask
        if (mask >> 3 & 0x01) {
            for (let index = 0; index < 4; index++) {
                if (mask_error >> index & 0x01) {
                    data.errors.push({
                        n: error_names[index],
                        v: 'error'
                    });
                }
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

function read_uint32(bytes) {
    let value = (bytes[0] << 24) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
    return value & 0xffffffff;
}