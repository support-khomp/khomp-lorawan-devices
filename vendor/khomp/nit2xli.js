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
    var data = {};
    var index = 0;

    data.device = [];
    data.internal_sensors = [];
    data.drys = [];
    data.probes = [];
    data.modules = [];
    data.lorawan = [];

    if (input.fPort !== 1) {
        var mask_sensor_inte = {};
        var mask_sensor_int = {};
        var mask_sensor_ext = {};
        var status_dry = ["OPEN", "CLOSED"];
        var status_relay = ["NO", "NC"];

        // Decode Model
        var model = {};
        model.n = 'model';
        model.u = 'string';
        switch (input.fPort) {
            case 3: model.v = "NIT20L"; break;
            case 4: model.v = "NIT21L"; break;
            default: model.v = "Unknow Model"; return { data };
        }
        data.device.push(model);

        mask_sensor_int = input.bytes[index++];

        // If Extented Internal Sensor Mask
        if (mask_sensor_int >> 7 & 0x01) {
            mask_sensor_inte = input.bytes[index++];
        }

        mask_sensor_ext = input.bytes[index++];

        // Environment Sensor
        if (mask_sensor_inte >> 0 & 0x01) {
            var env_sensor_status = {};
            env_sensor_status.n = 'env_sensor_status';
            env_sensor_status.u = 'string';
            env_sensor_status.v = 'fail';
            data.device.push(env_sensor_status);
        }

        // Decode Battery
        if (mask_sensor_int >> 0 & 0x01) {
            var battery = {};
            battery.n = 'battery';
            battery.v = (input.bytes[index++] / 10.0);
            battery.u = 'V';
            data.internal_sensors.push(battery);
        }

        // Decode Firmware Version
        if (mask_sensor_int >> 2 & 0x01) {
            var firmware = {};
            firmware.n = "firmware_version";
            firmware.u = 'string';
            firmware.v = input.bytes[index++] | (input.bytes[index++] << 8) | (input.bytes[index++] << 16);
            var hardware = (firmware.v / 1000000) >>> 0;
            var compatibility = ((firmware.v / 10000) - (hardware * 100)) >>> 0;
            var feature = ((firmware.v - (hardware * 1000000) - (compatibility * 10000)) / 100) >>> 0;
            var bug = (firmware.v - (hardware * 1000000) - (compatibility * 10000) - (feature * 100)) >>> 0;
            firmware.v = hardware + '.' + compatibility + '.' + feature + '.' + bug;
            data.device.push(firmware);
        }

        // Decode External Power or Battery
        var power = {};
        power.n = 'power';
        power.u = 'string';
        if (mask_sensor_int >> 5 & 0x01) {
            power.v = "external";
        }
        else {
            power.v = "battery";
        }
        data.device.push(power);

        // Decode Temperature Int
        if (mask_sensor_int >> 3 & 0x01) {
            var temperature = {};
            temperature.v = input.bytes[index++] | (input.bytes[index++] << 8);
            temperature.v = (temperature.v / 100.0) - 273.15;
            temperature.n = "temperature";
            temperature.u = "C";
            data.internal_sensors.push(temperature);
        }

        // Decode Moisture Int
        if (mask_sensor_int >> 4 & 0x01) {
            var humidity = {};
            humidity.v = input.bytes[index++] | (input.bytes[index++] << 8);
            humidity.v = humidity.v / 10.0;
            humidity.n = "humidity";
            humidity.u = "%";
            data.internal_sensors.push(humidity);
        }

        // Decode Drys
        if (mask_sensor_ext & 0x0F) {
            // Decode Dry 1 State
            if (mask_sensor_ext >> 0 & 0x01) {
                var dry = {};
                dry.n = 'c1_state';
                dry.v = status_dry[input.bytes[index++]];
                dry.u = 'boolean';
                data.drys.push(dry);
            }

            // Decode Dry 1 Count
            if (mask_sensor_ext >> 1 & 0x01) {
                var dry = {};
                dry.n = 'c1_count';
                dry.v = input.bytes[index++] | (input.bytes[index++] << 8);
                dry.u = 'counter';
                data.drys.push(dry);
            }

            // Decode Dry 2 State
            if (mask_sensor_ext >> 2 & 0x01) {
                var dry = {};
                dry.n = 'c2_state';
                dry.v = status_dry[input.bytes[index++]];
                dry.u = 'boolean';
                data.drys.push(dry);
            }

            // Decode Dry 2 Count
            if (mask_sensor_ext >> 3 & 0x01) {
                var dry = {};
                dry.n = 'c2_count';
                dry.v = input.bytes[index++] | (input.bytes[index++] << 8);
                dry.u = 'counter';
                data.drys.push(dry);
            }
        }

        // Decode DS18B20 Probe
        if (mask_sensor_ext >> 4 & 0x07) {
            var nb_probes = (mask_sensor_ext >> 4 & 0x07) >>> 0;
            for (var i = 0; i < nb_probes; i++) {
                var probe = {};
                var rom = {};
                probe.v = ((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0) - 273;
                probe.u = 'C';

                if (mask_sensor_ext >> 7 & 0x01) {
                    index += 7;
                    rom = (input.bytes[index--]).toString(16);

                    for (var j = 0; j < 7; j++) {
                        rom += (input.bytes[index--]).toString(16);
                    }
                    index += 9;
                } else {
                    rom = input.bytes[index++];
                }
                probe.n = 'temperature' + '_' + rom.toUpperCase();
                data.probes.push(probe);
            }
        }

        // Decode Extension Module(s).        
        if (input.bytes.length > index) {
            while (input.bytes.length > index) {
                switch (input.bytes[index]) {
                    case 1:
                        {
                            module.push("em_s104");
                            index++;
                            var mask_ems104 = input.bytes[index++];

                            // E1
                            if (mask_ems104 >> 0 & 0x01) {
                                var conn = {};
                                conn.n = 'ems_e1_temp';
                                conn.v = (input.bytes[index++] | (input.bytes[index++] << 8));
                                conn.v = (conn.v / 100.0) - 273.15;
                                conn.u = 'C';
                                data.modules.push(conn);
                            }

                            // E2
                            if (mask_ems104 >> 1 & 0x01) {
                                var conn = {};
                                conn.n = 'ems_e2_kpa';
                                conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0;
                                conn.u = 'kPa';
                                data.modules.push(conn);
                            }

                            // E3
                            if (mask_ems104 >> 2 & 0x01) {
                                var conn = {};
                                conn.n = 'ems_e3_kpa';
                                conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0;
                                conn.u = 'kPa';
                                data.modules.push(conn);
                            }

                            // E4
                            if (mask_ems104 >> 3 & 0x01) {
                                var conn = {};
                                conn.n = 'ems_e4_kpa';
                                conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0;
                                conn.u = 'kPa';
                                data.modules.push(conn);
                            }
                        }
                        break;

                    case 2:
                        {
                            index++;
                            var mask_emc104 = input.bytes[index++];

                            // Plus (Min Max and Avg)
                            if (mask_emc104 >> 4 & 0x01) {
                                for (var k = 0; k < 4; k++) {
                                    if ((mask_emc104 >> k) & 0x01) {
                                        var conn = {};
                                        conn.n = 'e' + (k + 1) + '_curr';
                                        conn.u = "mA";
                                        // Min
                                        if (mask_emc104 >> 5 & 0x01) {
                                            conn.min = input.bytes[index++] / 12.0;
                                        }
                                        // Max
                                        if (mask_emc104 >> 6 & 0x01) {
                                            conn.max = input.bytes[index++] / 12.0;
                                        }
                                        // Avg
                                        if (mask_emc104 >> 7 & 0x01) {
                                            conn.avg = input.bytes[index++] / 12.0;
                                        }
                                        data.modules.push(conn);
                                    }
                                }
                            } else {
                                // E1
                                if (mask_emc104 >> 0 & 0x01) {
                                    var conn = {};
                                    conn.n = 'emc_e1_curr';
                                    conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 1000.0;
                                    conn.u = "mA";
                                    data.modules.push(conn);
                                }

                                // E2
                                if (mask_emc104 >> 1 & 0x01) {
                                    var conn = {};
                                    conn.n = 'emc_e2_curr';
                                    conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 1000.0;
                                    conn.u = "mA";
                                    data.modules.push(conn);
                                }

                                // E3
                                if (mask_emc104 >> 2 & 0x01) {
                                    var conn = {};
                                    conn.n = 'emc_e3_curr';
                                    conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 1000.0;
                                    conn.u = "mA";
                                    data.modules.push(conn);
                                }

                                // E4
                                if (mask_emc104 >> 3 & 0x01) {
                                    var conn = {};
                                    conn.n = 'emc_e4_curr';
                                    conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 1000.0;
                                    conn.u = "mA";
                                    data.modules.push(conn);
                                }
                            }
                        }
                        break;

                    // EM W104
                    case 4:
                        {
                            index++;
                            var mask_emw104 = input.bytes[index++];

                            //Weather Station
                            if (mask_emw104 >> 0 & 0x01) {
                                //Rain
                                var conn = {};
                                conn.n = 'emw_rain_lvl';
                                conn.v = ((input.bytes[index++] << 8) | input.bytes[index++]) / 10.0;
                                conn.u = 'mm';
                                data.modules.push(conn);

                                //Average Wind Speed
                                var conn = {};
                                conn.n = 'emw_avg_wind_speed'
                                conn.v = input.bytes[index++];
                                conn.u = 'km/h';
                                data.modules.push(conn);

                                //Gust Wind Speed
                                var conn = {};
                                conn.n = 'emw_gust_wind_speed';
                                conn.v = input.bytes[index++];
                                conn.u = 'km/h';
                                data.modules.push(conn);

                                //Wind Direction
                                var conn = {};
                                conn.n = 'emw_wind_direction';
                                conn.v = (input.bytes[index++] << 8) | input.bytes[index++];
                                conn.u = 'graus';
                                data.modules.push(conn);

                                //Temperature
                                var conn = {};
                                conn.n = 'emw_temperature';
                                conn.v = ((input.bytes[index++] << 8) | input.bytes[index++]) / 10.0;
                                conn.v = conn.v - 273.15;
                                conn.u = 'C';
                                data.modules.push(conn);

                                //Humidity
                                var conn = {};
                                conn.n = 'emw_humidity';
                                conn.v = input.bytes[index++];
                                conn.u = '%';
                                data.modules.push(conn);

                                //Lux and UV
                                if (mask_emw104 >> 1 & 0x01) {
                                    var conn = {};
                                    conn.n = 'emw_luminosity';
                                    conn.v = (input.bytes[index++] << 16) | (input.bytes[index++] << 8) | input.bytes[index++];
                                    conn.u = 'lx';
                                    data.modules.push(conn);

                                    var conn = {};
                                    conn.n = 'emw_uv';
                                    conn.v = input.bytes[index++];
                                    conn.v = conn.v / 10.0;
                                    conn.u = '/';
                                    data.modules.push(conn);
                                }
                            }

                            //Pyranometer
                            if (mask_emw104 >> 2 & 0x01) {
                                var conn = {};
                                conn.n = 'emw_solar_radiation';
                                conn.v = (input.bytes[index++] << 8) | input.bytes[index++];
                                conn.v = conn.v / 10.0;
                                conn.u = 'W/m²';
                                data.modules.push(conn);
                            }

                            //Barometer
                            if (mask_emw104 >> 3 & 0x01) {
                                var conn = {};
                                conn.n = 'emw_atm_pres';
                                conn.v = (input.bytes[index++] << 16);
                                conn.v |= (input.bytes[index++] << 8) | input.bytes[index++] << 0;
                                conn.v = conn.v / 100.0;
                                conn.u = 'hPa²';
                                data.modules.push(conn);
                            }
                        }
                        break;

                    // EM R102
                    case 5:
                        {
                            index++;
                            var mask_emr102 = input.bytes[index++];
                            var mask_data = input.bytes[index++];

                            // E1
                            if (mask_emr102 >> 0 & 0x01) {
                                var conn = {};
                                conn.n = 'emr_c3_status';
                                conn.v = status_dry[(mask_data >> 0 & 0x01)];
                                conn.u = "bool";
                                data.modules.push(conn);

                                var conn = {};
                                conn.n = 'emr_c3_count';
                                conn.v = input.bytes[index++] | (input.bytes[index++] << 8);
                                data.modules.push(conn);
                            }

                            // E2
                            if (mask_emr102 >> 1 & 0x01) {
                                var conn = {};
                                conn.n = 'emr_c4_status';
                                conn.v = status_dry[(mask_data >> 1 & 0x01)];
                                conn.u = "bool";
                                data.modules.push(conn);

                                var conn = {};
                                conn.n = 'emr_c4_count';
                                conn.v = input.bytes[index++] | (input.bytes[index++] << 8);
                                data.modules.push(conn);
                            }

                            // E3
                            if (mask_emr102 >> 2 & 0x01) {
                                var conn = {};
                                conn.n = 'emr_b3_relay';
                                conn.v = status_relay[(mask_data >> 2 & 0x01)];
                                data.modules.push(conn);
                            }

                            // E4
                            if (mask_emr102 >> 3 & 0x01) {
                                var conn = {};
                                conn.n = 'emr_b4_relay';
                                conn.v = status_relay[(mask_data >> 3 & 0x01)];
                                data.modules.push(conn);
                            }

                        }
                        break;

                    // EM ACW100 & EM THW 100/200/201
                    case 6:
                        {
                            var module = [];
                            index++;
                            var prefix_name = {};
                            var em_thw_acw = {};
                            var one_wire_ext_model = 0x00;
                            var mask_em_acw_thw = input.bytes[index++];

                            if (mask_em_acw_thw == 0x03) {
                                one_wire_ext_model = 0x06;
                            }
                            else {
                                if (mask_em_acw_thw >> 0 & 0x01) {
                                    one_wire_ext_model |= 0x01;
                                }

                                if (mask_em_acw_thw >> 4 & 0x01) {
                                    one_wire_ext_model |= 0x02;
                                }
                            }

                            switch (one_wire_ext_model) {
                                case 0x01:
                                    em_thw_acw.n = 'em_thw_200';
                                    prefix_name = 'thw';
                                    break;
                                case 0x02:
                                    em_thw_acw.n = 'em_acw_100';
                                    prefix_name = 'acw';
                                    break;
                                case 0x03:
                                    em_thw_acw.n = 'em_thw_201';
                                    prefix_name = 'thw';
                                    break;
                                case 0x06:
                                    em_thw_acw.n = 'em_thw_100';
                                    prefix_name = 'thw';
                                    break;
                                default:
                                    em_thw_acw.n = 'unknow';
                                    break;
                            }

                            //ROM
                            if ((mask_sensor_ext >> 4 & 0x07) && (mask_sensor_ext >> 7 & 0x00)) {
                                rom.v = input.bytes[index++];
                            } else {
                                index += 7;
                                rom.v = (input.bytes[index--]).toString(16);

                                for (var j = 0; j < 7; j++) {
                                    rom.v += (input.bytes[index--]).toString(16);
                                }
                                index += 9;
                            }

                            //Temperature
                            if (mask_em_acw_thw >> 0 & 0x01) {
                                var sensor = {};
                                sensor.n = prefix_name + '_' + 'temperature' + '_' + rom.v.toUpperCase();
                                sensor.u = 'C';
                                sensor.v = ((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0) - 273.15;                              
                                data.modules.push(sensor);
                            }

                            //Humidity
                            if (mask_em_acw_thw >> 1 & 0x01) {
                                var sensor = {};
                                sensor.n = prefix_name + '_' + 'humidity' + '_' + rom.v.toUpperCase();
                                sensor.u = '%';
                                sensor.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0;                               
                                data.modules.push(sensor);
                            }

                            //Lux
                            if (mask_em_acw_thw >> 2 & 0x01) {
                                var sensor = {};
                                sensor.n = prefix_name + '_' + 'luminosity' + '_' + rom.v.toUpperCase();
                                sensor.u = 'lux';
                                sensor.v = input.bytes[index++] | (input.bytes[index++] << 8);                           
                                data.modules.push(sensor);
                            }

                            //Noise
                            if (mask_em_acw_thw >> 3 & 0x01) {
                                var sensor = {};
                                sensor.n = prefix_name + '_' + 'noise' + '_' + rom.v.toUpperCase();
                                sensor.u = 'dB';
                                sensor.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0;                             
                                data.modules.push(sensor);
                            }

                            //Temperature RTDT
                            if (mask_em_acw_thw >> 4 & 0x01) {
                                var sensor = {};
                                sensor.n = prefix_name + '_' + 'temperature_rtdt' + '_' + rom.v.toUpperCase();
                                sensor.u = 'C';
                                sensor.v = input.bytes[index++];
                                for (var j = 1; j < 4; j++) {
                                    sensor.v |= (input.bytes[index++] << (8 * j));
                                }
                                sensor.v = (sensor.v / 100.0) - 273.15;
                                data.modules.push(sensor);
                            }
                        }
                        break;

                    default:
                        {
                            return { data };
                        }
                }
            }
        }

    }
    else {
        var status_enable = ["disable", "enable"];
        var mask_lorawan = (input.bytes[index++] << 8) | input.bytes[index++];
        var mask_device = (input.bytes[index++] << 8) | input.bytes[index++];

        // LoRaWAN Configuration
        if (mask_lorawan !== 0) {
            if (mask_lorawan >> 0 & 0x01) {
                var time_report = {};
                time_report.n = 'time_report';
                time_report.v = (input.bytes[index++] << 8) | input.bytes[index++];
                time_report.u = 'minutes';
                data.lorawan.push(time_report);
            }

            if (mask_lorawan >> 4 & 0x01) {
                var adr = {};
                adr.n = 'adr';
                adr.v = status_enable[input.bytes[index++]];
                data.lorawan.push(adr);
            }

            if (mask_lorawan >> 7 & 0x01) {
                var regions = ["AS923", "AU915", "CN470", "CN779", "EU433", "EU868", "KR920", "IN865", "US915", "RU864", "LA915"];
                var region = {};
                region.n = 'region';
                region.v = regions[input.bytes[index++]];
                data.lorawan.push(region);
            }

            if (mask_lorawan >> 9 & 0x01) {
                var confirmed_message = {};
                confirmed_message.n = 'confirmed_message';
                confirmed_message.v = status_enable[input.bytes[index++]];
                data.lorawan.push(confirmed_message);
            }
        }

        // Device Configuration
        if (mask_device !== 0) {
            data.device = [];

            if (mask_device >> 0 & 0x01) {
                var delta_enable = {};
                delta_enable.n = 'delta_enable';
                delta_enable.v = status_enable[input.bytes[index++]];
                delta_enable.u = 'bool';
                data.device.push(delta_enable);

                var delta_internal_temp = {};
                delta_internal_temp.n = 'delta_internal_temp';
                delta_internal_temp.v = (input.bytes[index++] / 10.0);
                delta_internal_temp.u = 'Celsius';
                data.device.push(delta_internal_temp);

                var delta_internal_humi = {};
                delta_internal_humi.n = 'delta_internal_humi';
                delta_internal_humi.v = (input.bytes[index++] / 10.0);
                delta_internal_humi.u = '%';
                data.device.push(delta_internal_humi);

                var delta_probe_temp = {};
                delta_probe_temp.n = 'delta_probe_temp';
                delta_probe_temp.v = (input.bytes[index++] / 10.0);
                delta_probe_temp.u = 'Celsius';
                data.device.push(delta_probe_temp);
            }

            if (mask_device >> 1 & 0x01) {
                var dry_mask = input.bytes[index++];
                var dry_behavior_string = ["event", "high_frequency"];

                var dry1_behavior = {};
                dry1_behavior.n = 'dry1_behavior';
                dry1_behavior.v = dry_behavior_string[(dry_mask >> 0) & 0x01];
                data.device.push(dry1_behavior);

                var dry2_behavior = {};
                dry2_behavior.n = 'dry2_behavior';
                dry2_behavior.v = dry_behavior_string[(dry_mask >> 1) & 0x01];
                data.device.push(dry2_behavior);

                var dry1_send_periodic = {};
                dry1_send_periodic.n = 'dry1_send_periodic';
                dry1_send_periodic.v = status_enable[(dry_mask >> 2) & 0x01];
                data.device.push(dry1_send_periodic);

                var dry2_send_periodic = {};
                dry2_send_periodic.n = 'dry2_send_periodic';
                dry2_send_periodic.v = status_enable[(dry_mask >> 3) & 0x01];
                data.device.push(dry2_send_periodic);
            }

            if (mask_device >> 2 & 0x01) {
                var emc_mask = input.bytes[index++];

                var emc_e1 = {};
                emc_e1.n = 'emc_e1';
                emc_e1.v = status_enable[(emc_mask >> 0) & 0x01];
                data.device.push(emc_e1);

                var emc_e2 = {};
                emc_e2.n = 'emc_e2';
                emc_e2.v = status_enable[(emc_mask >> 1) & 0x01];
                data.device.push(emc_e2);

                var emc_e3 = {};
                emc_e3.n = 'emc_e3';
                emc_e3.v = status_enable[(emc_mask >> 2) & 0x01];
                data.device.push(emc_e3);

                var emc_e4 = {};
                emc_e4.n = 'emc_e4';
                emc_e4.v = status_enable[(emc_mask >> 3) & 0x01];
                data.device.push(emc_e4);

                var emc_min = {};
                emc_min.n = 'emc_min';
                emc_min.v = status_enable[(emc_mask >> 5) & 0x01];
                data.device.push(emc_min);

                var emc_max = {};
                emc_max.n = 'emc_max';
                emc_max.v = status_enable[(emc_mask >> 6) & 0x01];
                data.device.push(emc_max);

                var emc_avg = {};
                emc_avg.n = 'emc_avg';
                emc_avg.v = status_enable[(emc_mask >> 7) & 0x01];
                data.device.push(emc_avg);

                var emc_cali = {};
                var status_cali = ["not_calibrated", "calibrated"];
                emc_cali.n = 'emc_avg';
                emc_cali.v = status_cali[input.bytes[index++]];
                data.device.push(emc_cali);
            }
        }
    }

    return { data };
}