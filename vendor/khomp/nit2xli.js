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

        if (input.fPort < 3 || input.fPort > 4) {
            return {
                errors: ['invalid fPort'],
            };
        }

        // Decode Model
        data.device.push({
            n: 'model',
            v: input.fPort == 3 ? 'NIT 20LI' : 'NIT 21LI'
        });

        let mask_sensor_inte = {};
        let mask_sensor_int = {};
        let mask_sensor_ext = {};

        mask_sensor_int = input.bytes[index++];

        // If Extented Internal Sensor Mask
        if (mask_sensor_int >> 7 & 0x01) {
            mask_sensor_inte = input.bytes[index++];
        }

        mask_sensor_ext = input.bytes[index++];

        // Environment Sensor
        if (mask_sensor_inte >> 0 & 0x01) {
            data.device.push({
                n: 'env_sensor_status',
                v: 'fail'
            });
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
        data.device.push({
            n: 'power',
            v: (mask_sensor_int >> 5 & 0x01) ? 'external' : 'battery'
        });

        // Decode Temperature Int
        if (mask_sensor_int >> 3 & 0x01) {
            data.internal_sensors.push({
                n: 'temperature',
                v: (((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0) - 273.15).round(2),
                u: 'C'
            });
        }

        // Decode Moisture Int
        if (mask_sensor_int >> 4 & 0x01) {
            data.internal_sensors.push({
                n: 'humidity',
                v: ((input.bytes[index++] | (input.bytes[index++] << 8)) / 10).round(2),
                u: '%'
            });
        }

        // Decode Drys
        if (mask_sensor_ext & 0x0F) {
            // Decode Dry 1 State
            if (mask_sensor_ext >> 0 & 0x01) {
                data.drys.push({
                    n: 'c1_state',
                    v: input.bytes[index++] ? 'closed' : 'open',
                    u: 'boolean'
                });
            }

            // Decode Dry 1 Count
            if (mask_sensor_ext >> 1 & 0x01) {
                data.drys.push({
                    n: 'c1_count',
                    v: input.bytes[index++] | (input.bytes[index++] << 8)
                });
            }

            // Decode Dry 2 State
            if (mask_sensor_ext >> 2 & 0x01) {
                data.drys.push({
                    n: 'c2_state',
                    v: input.bytes[index++] ? 'closed' : 'open',
                    u: 'boolean'
                });
            }

            // Decode Dry 2 Count
            if (mask_sensor_ext >> 3 & 0x01) {
                data.drys.push({
                    n: 'c2_count',
                    v: input.bytes[index++] | (input.bytes[index++] << 8)
                });
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
                                data.modules.push({
                                    n: 'ems_e1_temp',
                                    v: (((input.bytes[index++] | input.bytes[index++] << 8) / 100.0) - 273.15).round(2),
                                    u: 'C'
                                });
                            }

                            // KPA
                            for (let k = 0; k < 3; k++) {
                                if (mask_ems104 >> (k + 1) & 0x01) {
                                    data.modules.push({
                                        n: 'ems_e' + k + 2 + '_kpa',
                                        v: ((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0).round(2),
                                        u: 'kPa',
                                    });
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
                                for (let k = 0; k < 4; k++) {
                                    if (mask_emc104 >> k & 0x01) {
                                        data.modules.push({
                                            n: 'emc_e' + (k + 1) + '_curr',
                                            v: ((input.bytes[index++] | (input.bytes[index++] << 8)) / 1000.0).round(1),
                                            u: 'mA'
                                        });
                                    }
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
                                data.modules.push({
                                    n: 'emw_rain_lvl',
                                    v: (((input.bytes[index++] << 8) | input.bytes[index++]) / 10.0).round(1),
                                    u: 'mm'
                                });

                                //Average Wind Speed
                                data.modules.push({
                                    n: 'emw_avg_wind_speed',
                                    v: input.bytes[index++],
                                    u: 'km/h'
                                });

                                //Gust Wind Speed
                                data.modules.push({
                                    n: 'emw_gust_wind_speed',
                                    v: input.bytes[index++],
                                    u: 'km/h'
                                });

                                //Wind Direction
                                data.modules.push({
                                    n: 'emw_wind_direction',
                                    v: (input.bytes[index++] << 8) | input.bytes[index++],
                                    u: 'graus'
                                });

                                //Temperature
                                data.modules.push({
                                    n: 'emw_temperature',
                                    v: ((((input.bytes[index++] << 8) | input.bytes[index++]) / 10.0) - 273.15).round(2),
                                    u: 'C'
                                });

                                //Humidity
                                data.modules.push({
                                    n: 'emw_humidity',
                                    v: input.bytes[index++],
                                    u: '%'
                                });

                                //Lux and UV
                                if (mask_emw104 >> 1 & 0x01) {
                                    data.modules.push({
                                        n: 'emw_luminosity',
                                        v: (input.bytes[index++] << 16) | (input.bytes[index++] << 8) | input.bytes[index++],
                                        u: 'lx'
                                    });

                                    data.modules.push({
                                        n: 'emw_uv',
                                        v: (input.bytes[index++] / 10.0).round(1),
                                        u: '/'
                                    });
                                }
                            }

                            //Pyranometer
                            if (mask_emw104 >> 2 & 0x01) {
                                data.modules.push({
                                    n: 'emw_solar_radiation',
                                    v: ((input.bytes[index++] << 8 | input.bytes[index++]) / 10.0).round(1),
                                    u: 'W/m²'
                                });
                            }

                            //Barometer
                            if (mask_emw104 >> 3 & 0x01) {
                                data.modules.push({
                                    n: 'emw_atm_pres',
                                    v: ((input.bytes[index++] << 16 | input.bytes[index++] << 8 | input.bytes[index++] << 0) / 100.0).round(2),
                                    u: 'hPa²'
                                });
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
                                data.modules.push({
                                    n: 'emr_c3_status',
                                    v: (mask_data >> 0 & 0x01) ? 'closed' : 'open',
                                    u: 'bool'
                                });

                                data.modules.push({
                                    n: 'emr_c3_count',
                                    v: input.bytes[index++] | input.bytes[index++] << 8,
                                });
                            }

                            // E2
                            if (mask_emr102 >> 1 & 0x01) {
                                data.modules.push({
                                    n: 'emr_c4_status',
                                    v: (mask_data >> 1 & 0x01) ? 'closed' : 'open',
                                    u: 'bool'
                                });

                                data.modules.push({
                                    n: 'emr_c4_count',
                                    v: input.bytes[index++] | input.bytes[index++] << 8,
                                });
                            }

                            // E3
                            if (mask_emr102 >> 2 & 0x01) {
                                data.modules.push({
                                    n: 'emr_b3_relay',
                                    v: (mask_data >> 2 & 0x01) ? 'NC' : 'NO'
                                });
                            }

                            // E4
                            if (mask_emr102 >> 3 & 0x01) {
                                data.modules.push({
                                    n: 'emr_b4_relay',
                                    v: (mask_data >> 3 & 0x01) ? 'NC' : 'NO'
                                });
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

                            prefix_name = em_thw_acw_name[one_wire_ext_model - 1];

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
                                data.modules.push({
                                    n: prefix_name + '_' + 'temperature' + '_' + rom,
                                    v: (((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0) - 273.15).round(2),
                                    u: 'C'
                                });
                            }

                            //Humidity
                            if (mask_em_acw_thw >> 1 & 0x01) {
                                data.modules.push({
                                    n: prefix_name + '_' + 'humidity' + '_' + rom,
                                    v: ((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0).round(2),
                                    u: '%'
                                });
                            }

                            //Lux
                            if (mask_em_acw_thw >> 2 & 0x01) {
                                data.modules.push({
                                    n: prefix_name + '_' + 'luminosity' + '_' + rom,
                                    v: input.bytes[index++] | (input.bytes[index++] << 8),
                                    u: 'lux'
                                });
                            }

                            //Noise
                            if (mask_em_acw_thw >> 3 & 0x01) {
                                data.modules.push({
                                    n: prefix_name + '_' + 'noise' + '_' + rom,
                                    v: ((input.bytes[index++] | (input.bytes[index++] << 8)) / 100.0).round(2),
                                    u: 'dB'
                                });
                            }

                            //Temperature RTDT
                            if (mask_em_acw_thw >> 4 & 0x01) {
                                data.modules.push({
                                    n: prefix_name + '_' + 'temperature_rtdt' + '_' + rom,
                                    v: (((input.bytes[index++] | (input.bytes[index++] << 8) | (input.bytes[index++] << 16) | (input.bytes[index++] << 24)) / 100.0) - 273.15).round(2),
                                    u: 'C'
                                });
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
                let time_report = ((input.bytes[index++] << 8) | input.bytes[index++]) * 60;
                data.lorawan.push({
                    n: 'time_report',
                    u: 'seconds',
                    v: time_report ? time_report : 30
                });
            }

            if (mask_lorawan >> 4 & 0x01) {
                data.lorawan.push({
                    n: 'adr',
                    v: status_enable[input.bytes[index++]]
                });
            }

            if (mask_lorawan >> 7 & 0x01) {
                const regions = ["AS923", "AU915", "CN470", "CN779", "EU433", "EU868", "KR920", "IN865", "US915", "RU864", "LA915"];
                data.lorawan.push({
                    n: 'region',
                    v: regions[input.bytes[index++]]
                });
            }

            if (mask_lorawan >> 9 & 0x01) {
                data.lorawan.push({
                    n: 'confirmed_message',
                    v: status_enable[input.bytes[index++]]
                });
            }
        }

        // Device Configuration
        if (mask_device !== 0) {
            if (mask_device >> 0 & 0x01) {
                data.device.push({
                    n: 'delta_enable',
                    v: status_enable[input.bytes[index++]],
                    u: 'bool'
                });

                data.device.push({
                    n: 'delta_internal_temp',
                    v: (input.bytes[index++] / 10.0),
                    u: 'C'
                });

                data.device.push({
                    n: 'delta_internal_humi',
                    v: (input.bytes[index++] / 10.0),
                    u: '%'
                });

                data.device.push({
                    n: 'delta_probe_temp',
                    v: (input.bytes[index++] / 10.0),
                    u: 'C'
                });
            }

            if (mask_device >> 1 & 0x01) {
                let dry_mask = input.bytes[index++];

                data.device.push({
                    n: 'dry1_behavior',
                    v: (dry_mask >> 0 & 0x01) ? 'high_frequency' : 'event'
                });

                data.device.push({
                    n: 'dry2_behavior',
                    v: (dry_mask >> 1 & 0x01) ? 'high_frequency' : 'event'
                });

                data.device.push({
                    n: 'dry1_send_periodic',
                    v: (dry_mask >> 2 & 0x01) ? 'enable' : 'disable'
                });

                data.device.push({
                    n: 'dry2_send_periodic',
                    v: (dry_mask >> 3 & 0x01) ? 'enable' : 'disable'
                });
            }

            if (mask_device >> 2 & 0x01) {
                let emc_mask = input.bytes[index++];

                for (let i = 0; i < 4; i++) {
                    if (emc_mask >> i & 0x01) {
                        data.modules.push({
                            n: 'emc_e' + (i + 1),
                            v: (emc_mask >> i & 0x01) ? 'enable' : 'disable'
                        });
                    }
                }

                const em_cfg = ['min', 'max', 'avg'];
                for (let i = 0; i < 3; i++) {
                    data.modules.push({
                        n: 'emc_' + em_cfg[i],
                        v: (emc_mask >> (i + 5) & 0x01) ? 'enable' : 'disable'
                    });
                }

                data.device.push({
                    n: 'emc_calibration',
                    v: input.bytes[index++] ? 'calibrated' : 'not_calibrated'
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

function read_uint32(bytes) {
    let value = (bytes[0] << 24) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
    return value & 0xffffffff;
}
