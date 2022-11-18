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
    let data = {};
    let index = 0;

    data.device = [];
    data.internal_sensors = [];
    data.drys = [];
    data.probes = [];
    data.modules = [];
    data.lorawan = [];

    if (input.fPort !== 1) {
        let mask_sensor_inte = {};
        let mask_sensor_int = {};
        let mask_sensor_ext = {};
        const status_dry = ["OPEN", "CLOSED"];
        const status_relay = ["NO", "NC"];

        // Decode Model
        let model = { n: 'model' };
        switch (input.fPort) {
            case 3: model.v = "NIT20L"; break;
            case 4: model.v = "NIT21L"; break;
            default: model.v = "Unknown model"; return { data };
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
            let env_sensor_status = { n: 'env_sensor_status', v: 'fail' };
            data.device.push(env_sensor_status);
        }

        // Decode Battery
        if (mask_sensor_int >> 0 & 0x01) {
            let battery = { n: 'battery', u: 'V' };
            if (mask_sensor_int >> 6 & 0x01) {
                battery.v = ((input.bytes[index++] / 120.0) + 1).round(2);
            }
            else {
                battery.v = (input.bytes[index++] / 10.0).round(1);
            }
            data.internal_sensors.push(battery);
        }

        // Decode Firmware Version
        if (mask_sensor_int >> 2 & 0x01) {
            let firmware = { n: 'firmware_version' };
            firmware.v = input.bytes[index++] | (input.bytes[index++] << 8) | (input.bytes[index++] << 16);
            let hardware = (firmware.v / 1000000) >>> 0;
            let compatibility = ((firmware.v / 10000) - (hardware * 100)) >>> 0;
            let feature = ((firmware.v - (hardware * 1000000) - (compatibility * 10000)) / 100) >>> 0;
            let bug = (firmware.v - (hardware * 1000000) - (compatibility * 10000) - (feature * 100)) >>> 0;
            firmware.v = hardware + '.' + compatibility + '.' + feature + '.' + bug;
            data.device.push(firmware);
        }

        // Decode External Power or Battery
        let power = { n: 'power', v: 'battery' };
        if (mask_sensor_int >> 5 & 0x01) {
            power.v = "external";
        }
        data.device.push(power);

        // Decode Temperature Int
        if (mask_sensor_int >> 3 & 0x01) {
            let temperature = { n: 'temperature', u: 'C' };
            temperature.v = input.bytes[index++] | (input.bytes[index++] << 8);
            temperature.v = ((temperature.v / 100.0) - 273.15).round(2);
            data.internal_sensors.push(temperature);
        }

        // Decode Moisture Int
        if (mask_sensor_int >> 4 & 0x01) {
            let humidity = { n: 'humidity', u: '%' };
            humidity.v = input.bytes[index++] | (input.bytes[index++] << 8);
            humidity.v = (humidity.v / 10.0).round(2);
            data.internal_sensors.push(humidity);
        }

        // Decode Drys
        if (mask_sensor_ext & 0x0F) {
            // Decode Dry 1 State
            let dry = { u: 'boolean' };
            if (mask_sensor_ext >> 0 & 0x01) {
                dry.n = 'c1_state';
                dry.v = status_dry[input.bytes[index++]];
                data.drys.push(dry);
            }

            // Decode Dry 1 Count
            if (mask_sensor_ext >> 1 & 0x01) {
                dry.n = 'c1_count';
                dry.v = input.bytes[index++] | (input.bytes[index++] << 8);
                dry.u = 'counter';
                data.drys.push(dry);
            }

            // Decode Dry 2 State
            if (mask_sensor_ext >> 2 & 0x01) {
                dry.n = 'c2_state';
                dry.v = status_dry[input.bytes[index++]];
                dry.u = 'boolean';
                data.drys.push(dry);
            }

            // Decode Dry 2 Count
            if (mask_sensor_ext >> 3 & 0x01) {
                dry.n = 'c2_count';
                dry.v = input.bytes[index++] | (input.bytes[index++] << 8);
                dry.u = 'counter';
                data.drys.push(dry);
            }
        }

        // Decode DS18B20 Probe
        if (mask_sensor_ext >> 4 & 0x07) {
            let nb_probes = (mask_sensor_ext >> 4 & 0x07) >>> 0;
            for (let i = 0; i < nb_probes; i++) {
                let probe = { u: 'C' };
                let rom = {};

                probe.v = (((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0) - 273.15).round(2);
                if (mask_sensor_ext >> 7 & 0x01) {
                    index += 7;
                    rom = (input.bytes[index--]).toString(16);
                    for (let j = 0; j < 7; j++) {
                        rom += (input.bytes[index--]).toString(16);
                    }
                    index += 9;
                } else {
                    rom = input.bytes[index++];
                }
                probe.n = 'temperature' + '_' + rom;
                data.probes.push(probe);
            }
        }

        // Decode Extension Module(s).        
        if (input.bytes.length > index) {
            while (input.bytes.length > index) {
                switch (input.bytes[index]) {
                    case 1:
                        {
                            index++;
                            let mask_ems104 = input.bytes[index++];

                            // E1
                            if (mask_ems104 >> 0 & 0x01) {
                                let ems = { n: 'ems_e1_temp', u: 'C' };
                                ems.v = (input.bytes[index++] | (input.bytes[index++] << 8));
                                ems.v = ((ems.v / 100.0) - 273.15).round(2);
                                data.modules.push(ems);
                            }

                            // KPA
                            const kpa_name = ['e2_kpa', 'e3_kpa', 'e4_kpa'];
                            for (let index = 0; index < 3; index++) {
                                if (mask_ems104 >> (index + 1) & 0x01) {
                                    let ems = { u: 'kPa', n: 'ems_' + kpa_name[index] };
                                    ems.v = ((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0).round(2);
                                    data.modules.push(ems);
                                }
                            }
                        }
                        break;

                    case 2:
                        {
                            index++;
                            let mask_emc104 = input.bytes[index++];

                            // Plus (Min Max and Avg)
                            if (mask_emc104 >> 4 & 0x01) {
                                for (let k = 0; k < 4; k++) {
                                    if ((mask_emc104 >> k) & 0x01) {
                                        let conn = {};
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
                                    let conn = {};
                                    conn.n = 'emc_e1_curr';
                                    conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 1000.0;
                                    conn.u = "mA";
                                    data.modules.push(conn);
                                }

                                // E2
                                if (mask_emc104 >> 1 & 0x01) {
                                    let conn = {};
                                    conn.n = 'emc_e2_curr';
                                    conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 1000.0;
                                    conn.u = "mA";
                                    data.modules.push(conn);
                                }

                                // E3
                                if (mask_emc104 >> 2 & 0x01) {
                                    let conn = {};
                                    conn.n = 'emc_e3_curr';
                                    conn.v = (input.bytes[index++] | (input.bytes[index++] << 8)) / 1000.0;
                                    conn.u = "mA";
                                    data.modules.push(conn);
                                }

                                // E4
                                if (mask_emc104 >> 3 & 0x01) {
                                    let conn = {};
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
                            let mask_emw104 = input.bytes[index++];

                            //Weather Station
                            if (mask_emw104 >> 0 & 0x01) {
                                //Rain
                                let emw_rain_lvl = { n: 'emw_rain_lvl', u: 'mm' };
                                emw_rain_lvl.v = (((input.bytes[index++] << 8) | input.bytes[index++]) / 10.0).round(1);
                                data.modules.push(emw_rain_lvl);

                                //Average Wind Speed
                                let emw_avg_wind_speed = { n: 'emw_avg_wind_speed', u: 'km/h' };
                                emw_avg_wind_speed.v = input.bytes[index++];
                                data.modules.push(emw_avg_wind_speed);

                                //Gust Wind Speed
                                let emw_gust_wind_speed = { n: 'emw_gust_wind_speed', u: 'km/h' };
                                emw_gust_wind_speed.v = input.bytes[index++];
                                data.modules.push(emw_gust_wind_speed);

                                //Wind Direction
                                let emw_wind_direction = { n: 'emw_wind_direction', u: 'graus' };
                                emw_wind_direction.v = (input.bytes[index++] << 8) | input.bytes[index++];
                                data.modules.push(emw_wind_direction);

                                //Temperature
                                let emw_temperature = { n: 'emw_temperature', u: 'C' };
                                emw_temperature.v = ((input.bytes[index++] << 8) | input.bytes[index++]) / 10.0;
                                emw_temperature.v = (emw_temperature.v - 273.15).round(2);
                                data.modules.push(emw_temperature);

                                //Humidity
                                let emw_humidity = { n: 'emw_humidity', u: '%' };
                                emw_humidity.v = input.bytes[index++];
                                data.modules.push(emw_humidity);

                                //Lux and UV
                                if (mask_emw104 >> 1 & 0x01) {
                                    let emw_luminosity = { n: 'emw_luminosity', u: 'lx' };
                                    emw_luminosity.v = (input.bytes[index++] << 16) | (input.bytes[index++] << 8) | input.bytes[index++];
                                    data.modules.push(emw_luminosity);

                                    let emw_uv = { n: 'emw_uv', u: '/' };
                                    emw_uv.v = input.bytes[index++];
                                    emw_uv.v = (emw_uv.v / 10.0).round(1);
                                    data.modules.push(emw_uv);
                                }
                            }

                            //Pyranometer
                            if (mask_emw104 >> 2 & 0x01) {
                                let conn = { n: 'emw_solar_radiation', u: 'W/m²' };
                                conn.v = (input.bytes[index++] << 8) | input.bytes[index++];
                                conn.v = (conn.v / 10.0).round(1);
                                data.modules.push(conn);
                            }

                            //Barometer
                            if (mask_emw104 >> 3 & 0x01) {
                                let conn = { n: 'emw_atm_pres', u: 'hPa²' };
                                conn.v = (input.bytes[index++] << 16);
                                conn.v |= (input.bytes[index++] << 8) | input.bytes[index++] << 0;
                                conn.v = (conn.v / 100.0).round(2);
                                data.modules.push(conn);
                            }
                        }
                        break;

                    // EM R102
                    case 5:
                        {
                            index++;
                            let mask_emr102 = input.bytes[index++];
                            let mask_data = input.bytes[index++];

                            // E1
                            if (mask_emr102 >> 0 & 0x01) {
                                let status = {};
                                status.n = 'emr_c3_status';
                                status.v = status_dry[(mask_data >> 0 & 0x01)];
                                status.u = "bool";
                                data.modules.push(status);

                                let count = {};
                                count.n = 'emr_c3_count';
                                count.v = input.bytes[index++] | (input.bytes[index++] << 8);
                                data.modules.push(count);
                            }

                            // E2
                            if (mask_emr102 >> 1 & 0x01) {
                                let status = {};
                                status.n = 'emr_c4_status';
                                status.v = status_dry[(mask_data >> 1 & 0x01)];
                                status.u = "bool";
                                data.modules.push(status);

                                let count = {};
                                count.n = 'emr_c4_count';
                                count.v = input.bytes[index++] | (input.bytes[index++] << 8);
                                data.modules.push(count);
                            }

                            // E3
                            if (mask_emr102 >> 2 & 0x01) {
                                let conn = {};
                                conn.n = 'emr_b3_relay';
                                conn.v = status_relay[(mask_data >> 2 & 0x01)];
                                data.modules.push(conn);
                            }

                            // E4
                            if (mask_emr102 >> 3 & 0x01) {
                                let conn = {};
                                conn.n = 'emr_b4_relay';
                                conn.v = status_relay[(mask_data >> 3 & 0x01)];
                                data.modules.push(conn);
                            }

                        }
                        break;

                    // EM ACW100 & EM THW 100/200/201
                    case 6:
                        {
                            index++;
                            let rom = {};
                            let prefix_name = {};
                            let one_wire_ext_model = 0x00;
                            let mask_em_acw_thw = input.bytes[index++];
                            const em_thw_acw_name = ['em_thw_200', 'em_acw_100', 'em_thw_201', 'unknown', 'unknown', 'em_thw_100'];

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

                            prefix_name = em_thw_acw_name[one_wire_ext_model + 1]

                            //ROM
                            if ((mask_sensor_ext >> 4 & 0x07) && (mask_sensor_ext >> 7 & 0x00)) {
                                rom = input.bytes[index++];
                            } else {
                                index += 7;
                                rom = (input.bytes[index--]).toString(16);

                                for (let j = 0; j < 7; j++) {
                                    rom += (input.bytes[index--]).toString(16);
                                }
                                index += 9;
                            }

                            //Temperature
                            if (mask_em_acw_thw >> 0 & 0x01) {
                                let sensor = { n: prefix_name + '_' + 'temperature' + '_' + rom, u: 'C' };
                                sensor.v = (((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0) - 273.15).round(2);
                                data.modules.push(sensor);
                            }

                            //Humidity
                            if (mask_em_acw_thw >> 1 & 0x01) {
                                let sensor = { n: prefix_name + '_' + 'humidity' + '_' + rom, u: '%' };
                                sensor.v = ((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0).round(2);
                                data.modules.push(sensor);
                            }

                            //Lux
                            if (mask_em_acw_thw >> 2 & 0x01) {
                                let sensor = { n: prefix_name + '_' + 'luminosity' + '_' + rom, u: 'lux' };
                                sensor.v = input.bytes[index++] | (input.bytes[index++] << 8);
                                data.modules.push(sensor);
                            }

                            //Noise
                            if (mask_em_acw_thw >> 3 & 0x01) {
                                let sensor = { n: prefix_name + '_' + 'noise' + '_' + rom, u: 'dB' };
                                sensor.v = ((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0).round(2);
                                data.modules.push(sensor);
                            }

                            //Temperature RTDT
                            if (mask_em_acw_thw >> 4 & 0x01) {
                                let sensor = { n: prefix_name + '_' + 'temperature_rtdt' + '_' + rom, u: 'C' };
                                sensor.v = input.bytes[index++];
                                for (let j = 1; j < 4; j++) {
                                    sensor.v |= (input.bytes[index++] << (8 * j));
                                }
                                sensor.v = ((sensor.v / 100.0) - 273.15).round(2);
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
        const status_enable = ["disable", "enable"];
        let mask_lorawan = (input.bytes[index++] << 8) | input.bytes[index++];
        let mask_device = (input.bytes[index++] << 8) | input.bytes[index++];

        // LoRaWAN Configuration
        if (mask_lorawan !== 0) {
            if (mask_lorawan >> 0 & 0x01) {
                let time_report = { n: 'time_report', u: 'minutes', v: (input.bytes[index++] << 8) | input.bytes[index++] };
                data.lorawan.push(time_report);
            }

            if (mask_lorawan >> 4 & 0x01) {
                let adr = { n: 'adr', v: status_enable[input.bytes[index++]] };
                data.lorawan.push(adr);
            }

            if (mask_lorawan >> 7 & 0x01) {
                const regions = ["AS923", "AU915", "CN470", "CN779", "EU433", "EU868", "KR920", "IN865", "US915", "RU864", "LA915"];
                let region = { n: 'region', v: regions[input.bytes[index++]] };
                data.lorawan.push(region);
            }

            if (mask_lorawan >> 9 & 0x01) {
                let confirmed_message = { n: 'confirmed_message', v: status_enable[input.bytes[index++]] };
                data.lorawan.push(confirmed_message);
            }
        }

        // Device Configuration
        if (mask_device !== 0) {
            data.device = [];

            if (mask_device >> 0 & 0x01) {
                let delta_enable = { n: 'delta_enable', v: status_enable[input.bytes[index++]], u: 'bool' };
                data.device.push(delta_enable);

                let delta_internal_temp = { n: 'delta_internal_temp', v: (input.bytes[index++] / 10.0), u: 'C' };
                data.device.push(delta_internal_temp);

                let delta_internal_humi = { n: 'delta_internal_humi', v: (input.bytes[index++] / 10.0), u: '%' };
                data.device.push(delta_internal_humi);

                let delta_probe_temp = { n: 'delta_probe_temp', v: (input.bytes[index++] / 10.0), u: 'C' };
                data.device.push(delta_probe_temp);
            }

            if (mask_device >> 1 & 0x01) {
                let dry_mask = input.bytes[index++];
                const dry_behavior_string = ["event", "high_frequency"];

                let dry1_behavior = {};
                dry1_behavior.n = 'dry1_behavior';
                dry1_behavior.v = dry_behavior_string[(dry_mask >> 0) & 0x01];
                data.device.push(dry1_behavior);

                let dry2_behavior = {};
                dry2_behavior.n = 'dry2_behavior';
                dry2_behavior.v = dry_behavior_string[(dry_mask >> 1) & 0x01];
                data.device.push(dry2_behavior);

                let dry1_send_periodic = {};
                dry1_send_periodic.n = 'dry1_send_periodic';
                dry1_send_periodic.v = status_enable[(dry_mask >> 2) & 0x01];
                data.device.push(dry1_send_periodic);

                let dry2_send_periodic = {};
                dry2_send_periodic.n = 'dry2_send_periodic';
                dry2_send_periodic.v = status_enable[(dry_mask >> 3) & 0x01];
                data.device.push(dry2_send_periodic);
            }

            if (mask_device >> 2 & 0x01) {
                let emc_mask = input.bytes[index++];

                let emc_e1 = {};
                emc_e1.n = 'emc_e1';
                emc_e1.v = status_enable[(emc_mask >> 0) & 0x01];
                data.device.push(emc_e1);

                let emc_e2 = {};
                emc_e2.n = 'emc_e2';
                emc_e2.v = status_enable[(emc_mask >> 1) & 0x01];
                data.device.push(emc_e2);

                let emc_e3 = {};
                emc_e3.n = 'emc_e3';
                emc_e3.v = status_enable[(emc_mask >> 2) & 0x01];
                data.device.push(emc_e3);

                let emc_e4 = {};
                emc_e4.n = 'emc_e4';
                emc_e4.v = status_enable[(emc_mask >> 3) & 0x01];
                data.device.push(emc_e4);

                let emc_min = {};
                emc_min.n = 'emc_min';
                emc_min.v = status_enable[(emc_mask >> 5) & 0x01];
                data.device.push(emc_min);

                let emc_max = {};
                emc_max.n = 'emc_max';
                emc_max.v = status_enable[(emc_mask >> 6) & 0x01];
                data.device.push(emc_max);

                let emc_avg = {};
                emc_avg.n = 'emc_avg';
                emc_avg.v = status_enable[(emc_mask >> 7) & 0x01];
                data.device.push(emc_avg);

                let emc_cali = {};
                const status_cali = ["not_calibrated", "calibrated"];
                emc_cali.n = 'emc_avg';
                emc_cali.v = status_cali[input.bytes[index++]];
                data.device.push(emc_cali);
            }
        }
    }

    return { data };
}

Number.prototype.round = function (n) {
    const d = Math.pow(10, n);
    return Math.round((this + Number.EPSILON) * d) / d;
}