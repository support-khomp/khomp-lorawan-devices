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
    var mask = 0;
    var mask_index = 0;

    var mask_status = 0;
    var mask_status_index = 0;

    var mask_sensor = 0;
    var mask_sensor_index = 0;

    var mask_alert = 0;
    var mask_alert_index = 0;

    var mask_error = 0;
    var mask_error_index = 0

    var data = {};
    var decode_ver = input.bytes[i++];
    
    data.device = [];
    data.status = [];
    data.sensors = [];
    data.alerts = [];
    data.errors = [];

    if (decode_ver == 1) {
        var model = {};
        model.n = 'model';
        model.u = 'string';
        switch (input.fPort) {
            case 14: model.v = "ITP_200"; break;
            case 15: model.v = "ITP_202"; break;
            default: model.v = "Unknow Model"; return data;
        }

        data.device.push(model);

        mask = input.bytes[i++];

        // Status mask
        if (mask >> mask_index++ & 0x01) {
            mask_status = (input.bytes[i++] << 8) | input.bytes[i++];
        }

        // Sensor mask
        if (mask >> mask_index++ & 0x01) {
            mask_sensor = (input.bytes[i++] << 8) | input.bytes[i++];
        }

        // Alert mask
        if (mask >> mask_index++ & 0x01) {
            mask_alert = (input.bytes[i++] << 8) | input.bytes[i++];
        }

        // Error mask
        if (mask >> mask_index++ & 0x01) {
            mask_error = input.bytes[i++];
        }

        // Status mask input.bytes
        if (mask >> 0 & 0x01) {
            // Firmware
            if (mask_status >> mask_status_index++ & 0x01) {
                var firmware = {};
                firmware.n = "firmware_version";
                firmware.v = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
                firmware.v += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
                firmware.u = 'string';
                data.device.push(firmware);
            }

            // Dimmer Duty
            if (mask_status >> mask_status_index++ & 0x01) {
                var dimmer = {};
                dimmer.n = 'dimmer';
                dimmer.v = input.bytes[i++];
                dimmer.u = '%';
                data.status.push(dimmer);
            }

            // Operation mode
            if (mask_status >> mask_status_index++ & 0x01) {
                var operation_mode = {};
                var string_op_mode = ["manual", "automatic", "slot", "sunriset"];
                operation_mode.n = 'operation_mode';
                operation_mode.v = string_op_mode[input.bytes[i++]];
                operation_mode.u = 'string';
                data.status.push(operation_mode);
            }

            // Slot running
            if (mask_status >> mask_status_index++ & 0x01) {
                var slot_running = {};
                slot_running.n = 'slot_running';
                slot_running.v = input.bytes[i++];
                slot_running.u = 'string';
                data.status.push(slot_running);
            }
            // Light state
            var light_state = {};
            light_state.n = 'light_state';
            light_state.u = 'string';

            if (mask_status >> mask_status_index++ & 0x01) {
                light_state.v = 'on';
            }
            else {
                light_state.v = 'off';
            }
            data.status.push(light_state);


            // Relay Switching Counter
            if (mask_status >> mask_status_index++ & 0x01) {
                var relay_switching_counter = {};
                relay_switching_counter.n = 'relay_switching_counter';
                relay_switching_counter.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
                relay_switching_counter.u = 'counter';
                data.status.push(relay_switching_counter);
            }

            // Relay active time
            if (mask_status >> mask_status_index++ & 0x01) {
                var relay_active_time = {};
                relay_active_time.n = 'relay_active_time';
                relay_active_time.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
                relay_active_time.u = 'seconds';
                data.status.push(relay_active_time);
            }

            // Coordinates fixed
            var coordinates_fixed = {};
            coordinates_fixed.n = 'coordinates_fixed';
            coordinates_fixed.u = 'string';
            if (mask_status >> mask_status_index++ & 0x01) {
                coordinates_fixed.v = 'fixed';
            }
            else {
                coordinates_fixed.v = 'not_fixed';
            }
            data.status.push(coordinates_fixed);

            // timestamp_sync
            var timestamp_sync = {};
            timestamp_sync.n = 'timestamp_sync';
            timestamp_sync.u = 'string';
            if (mask_status >> mask_status_index++ & 0x01) {
                timestamp_sync.v = 'syncronized';

                // Timestamp
                if (mask_status >> mask_status_index++ & 0x01) {
                    var timestamp = {};
                    timestamp.n = 'timestamp';
                    timestamp.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
                    timestamp.u = 'seconds';
                    data.status.push(timestamp);
                }
            }
            else {
                mask_index++;
                timestamp_sync.v = 'not_syncronized';
            }

            data.status.push(timestamp_sync);
        }

        // Sensor mask input.bytes
        if (mask >> 1 & 0x01) {
            // Temperature
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var temperature = {};
                temperature.n = 'temperature';
                temperature.v = (input.bytes[i++] / 2) - 15;
                temperature.u = 'C';
                data.sensors.push(temperature);
            }

            // Ambient Light
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var ambient_light = {};
                ambient_light.n = 'ambient_light';
                ambient_light.v = (input.bytes[i++] << 8) | input.bytes[i++];
                ambient_light.u = 'lux';
                data.sensors.push(ambient_light);
            }

            // Angle
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var angle = {};
                angle.n = 'angle';
                angle.v = (input.bytes[i++] / 2.5);
                angle.u = 'degree';
                data.sensors.push(angle);
            }

            // Frequency
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var frequency = {};
                frequency.n = 'frequency';
                frequency.v = ((input.bytes[i++] / 10.0) + 45);
                frequency.u = 'Hz';
                data.sensors.push(frequency);
            }

            // Power Factor
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var pwr_factor = {};
                pwr_factor.n = 'pwr_factor';
                pwr_factor.v = ((input.bytes[i++] / 100.0) - 1);
                pwr_factor.u = '/';
                data.sensors.push(pwr_factor);
            }

            // Voltage
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var voltage = {};
                voltage.n = 'voltage';
                voltage.v = (((input.bytes[i++] << 8) | input.bytes[i++]) / 10.0);
                voltage.u = 'V';
                data.sensors.push(voltage);
            }

            // Current
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var current = {};
                current.n = 'current';
                current.v = (((input.bytes[i++] << 8) | input.bytes[i++]) / 1000.0);
                current.u = 'A';
                data.sensors.push(current);
            }

            // Active Energy
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var active_energy = {};
                active_energy.n = 'active_energy';
                active_energy.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
                active_energy.u = 'Wh';
                data.sensors.push(active_energy);
            }

            // Reactive Energy
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var reactive_energy = {};
                reactive_energy.n = 'reactive_energy';
                reactive_energy.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
                reactive_energy.u = 'varh';
                data.sensors.push(reactive_energy);
            }

            // Coordinates
            if (mask_sensor >> mask_sensor_index++ & 0x01) {
                var latitude = {};
                latitude.n = 'latitude';
                latitude.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
                latitude.v = ((latitude.v / 1000000.0) - 90);
                latitude.u = 'DD';
                data.sensors.push(latitude);

                var longitude = {};
                longitude.n = 'longitude';
                longitude.v = ((input.bytes[i++] << 24) | (input.bytes[i++] << 16) | (input.bytes[i++] << 8) | input.bytes[i++]);
                longitude.v = ((longitude.v / 1000000.0) - 180);
                longitude.u = 'DD';
                data.sensors.push(longitude);
            }
        }

        // Alerts mask input.bytes
        if (mask >> 2 & 0x01) {
            // Pin 
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var pin_changed = {};
                pin_changed.n = 'pin_changed';
                pin_changed.u = 'string';
                pin_changed.v = 'alert';
                data.alerts.push(pin_changed);
            }

            // Over current
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var over_current = {};
                over_current.n = 'over_current';
                over_current.u = 'string';
                over_current.v = 'alert';
                data.alerts.push(over_current);
            }

            // Under voltage
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var under_voltage = {};
                under_voltage.n = 'under_voltage';
                under_voltage.u = 'string';
                under_voltage.v = 'alert';
                data.alerts.push(under_voltage);
            }

            // Over voltage
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var over_voltage = {};
                over_voltage.n = 'over_voltage';
                over_voltage.u = 'string';
                over_voltage.v = 'alert';
                data.alerts.push(over_voltage);
            }

            // Under temperature
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var under_temperature = {};
                under_temperature.n = 'under_temperature';
                under_temperature.u = 'string';
                under_temperature.v = 'alert';
                data.alerts.push(under_temperature);
            }

            // Over temperature
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var over_temperature = {};
                over_temperature.n = 'over_temperature';
                over_temperature.u = 'string';
                over_temperature.v = 'alert';
                data.alerts.push(over_temperature);
            }

            // Over angle
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var over_angle = {};
                over_angle.n = 'over_angle';
                over_angle.u = 'string';
                over_angle.v = 'alert';
                data.alerts.push(over_angle);
            }

            // soft_reset
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var soft_reset = {};
                soft_reset.n = 'soft_reset';
                soft_reset.u = 'string';
                soft_reset.v = 'alert';
                data.alerts.push(soft_reset);
            }

            // hard_reset
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var hard_reset = {};
                hard_reset.n = 'hard_reset';
                hard_reset.u = 'string';
                hard_reset.v = 'alert';
                data.alerts.push(hard_reset);
            }

            // acc_energy_reset
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var acc_energy_reset = {};
                acc_energy_reset.n = 'acc_energy_reset';
                acc_energy_reset.u = 'string';
                acc_energy_reset.v = 'alert';
                data.alerts.push(acc_energy_reset);
            }

            // poss_pwr_fail
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var poss_pwr_fail = {};
                poss_pwr_fail.n = 'poss_pwr_fail';
                poss_pwr_fail.u = 'string';
                poss_pwr_fail.v = 'alert';
                data.alerts.push(poss_pwr_fail);
            }

            // no_load_detec
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var no_load_detec = {};
                no_load_detec.n = 'no_load_detec';
                no_load_detec.u = 'string';
                no_load_detec.v = 'alert';
                data.alerts.push(no_load_detec);
            }

            // Power Alarm
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var pwr_alarm = {};
                pwr_alarm.n = 'pwr_alarm';
                pwr_alarm.u = 'string';
                pwr_alarm.v = 'alert';
                data.alerts.push(pwr_alarm);
            }

            // max_relay_act
            if (mask_alert >> mask_alert_index++ & 0x01) {
                var max_relay_act = {};
                max_relay_act.n = 'max_relay_act';
                max_relay_act.u = 'string';
                max_relay_act.v = 'alert';
                data.alerts.push(max_relay_act);
            }

        }
        // Error mask
        if (mask >> 3 & 0x01) {
            // Power meter
            if (mask_error >> mask_error_index++ & 0x01) {
                var power_meter_err = {};
                power_meter_err.n = 'power_meter_err';
                power_meter_err.u = 'string';
                power_meter_err.v = 'error';
                data.errors.push(power_meter_err);
            }

            // Ambient Light
            if (mask_error >> mask_error_index++ & 0x01) {
                var ambient_light_err = {};
                ambient_light_err.n = 'ambient_light_err';
                ambient_light_err.u = 'string';
                ambient_light_err.v = 'error';
                data.errors.push(ambient_light_err);
            }

            // Accelerometer
            if (mask_error >> mask_error_index++ & 0x01) {
                var accelerometer_err = {};
                accelerometer_err.n = 'accelerometer_err';
                accelerometer_err.u = 'string';
                accelerometer_err.v = 'error';
                data.errors.push(accelerometer_err);
            }

            // GPS
            if (mask_error >> mask_error_index++ & 0x01) {
                var gps_err = {};
                gps_err.n = 'gps_err';
                gps_err.u = 'string';
                gps_err.v = 'error';
                data.errors.push(gps_err);
            }
        }
    }

    return {data};
}

// Encode downlink function.
//
// Input is an object with the following fields:
// - data = Object representing the payload that must be encoded.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - bytes = Byte array containing the downlink payload.
function encodeDownlink(input) {
    return {
        data: [225, 230, 255, 0]
    };
}