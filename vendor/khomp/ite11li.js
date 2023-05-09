// Decode uplink function.
//
// Input is an object with the following fields:
// - bytes = Byte array containing the uplink payload, e.g. [255, 230, 255, 0]
// - fPort = Uplink fPort.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - data = Object representing the decoded payload.

const phases_name = ["phase_a", "phase_b", "phase_c"];
const tc_config_name = [
    "POWCT-T16-150-333", "POWCT-T24-250-333", "POWCT-T36-630-333", 
    "POWCT-T50-1500-333", "POWCT-T16-25-333", "POWCT-T16-40-333", 
    "POWCT-T16-100-333"];

function decodeUplink(input) {
    let i = 0;
    let data = {};
    let decode_ver = input.bytes[i++];

    data.device = [];
    data.sensors = [];

    if (input.fPort != 10) {
        data.device.push({
            n: 'model',
            v: 'Unknown model'
        });
        return { data };
    }

    data.device.push({
        n: 'model',
        v: 'ITE 11LI'
    });

    mask = read_uint16(input.bytes.slice(i, i += 2));

    // Firmware
    if (mask >> 0 & 0x01) {
        let firmware = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
        firmware += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
        data.device.push({
            n: 'firmware_version',
            v: firmware
        });
    }

    // Temperature
    if (mask >> 1 & 0x01) {
        data.sensors.push({
            n: 'temperature',
            v: (input.bytes[i++] / 2).round(1),
            u: 'C'
        });
    }

    // Frequency
    if (mask >> 2 & 0x01) {
        data.sensors.push({
            n: 'frequency',
            v: ((input.bytes[i++] / 10.0) + 45).round(1),
            u: 'Hz'
        });
    }

    let total_ac_energy = 0;
    let total_re_energy = 0;

    for (let index = 0; index < 3; index++) {
        if (mask >> (3 + index) & 0x01) {
          	let voltage = (read_uint16(input.bytes.slice(i, i += 2)) / 10.0).round(1);
            data.sensors.push({
                n: phases_name[index] + '_' + 'voltage',
                v: voltage,
                u: 'V'
            });

            let current;
            if (decode_ver == 1) {
                current = (read_uint16(input.bytes.slice(i, i += 2)) / 1000.0).round(3);
            }
            else {
                current = (read_uint16(input.bytes.slice(i, i += 2)) / 20.0).round(2);
            }

            data.sensors.push({
                n: phases_name[index] + '_' + 'current',
                v: current,
                u: 'A'
            });

          	let pwr_factor = ((input.bytes[i++] / 100.0) - 1).round(2);
            data.sensors.push({
                n: phases_name[index] + '_' + 'pwr_factor',
                v: pwr_factor,
                u: '/'
            });

            let active_energy = (read_uint32(input.bytes.slice(i, i += 4)) / 100.0).round(2);
            data.sensors.push({
                n: phases_name[index] + '_' + 'active_energy',
                v: active_energy,
                u: 'kWh'
            });
            total_ac_energy += active_energy;

            let reactive_energy = (read_uint32(input.bytes.slice(i, i += 4)) / 100.0).round(2);
            data.sensors.push({
                n: phases_name[index] + '_' + 'reactive_energy',
                v: reactive_energy,
                u: 'kVArh'
            });
            total_re_energy += reactive_energy;

            data.sensors.push({
                n: phases_name[index] + '_' + 'tc_config',
                v: tc_config_name[input.bytes[i++]],
            });
          
          let apparent_power = voltage*current;
          data.sensors.push({
                n: phases_name[index] + '_' + 'apparent_power',
                v: apparent_power.round(2),
            	u: 'VA'
            });
          
          let active_power = (apparent_power*pwr_factor);
          data.sensors.push({
                n: phases_name[index] + '_' + 'active_power',
                v: active_power.round(2),
            	u: 'W'
            });
          
          let reactive_power = Math.sqrt(Math.pow(apparent_power, 2) - Math.pow(active_power, 2));
          data.sensors.push({
                n: phases_name[index] + '_' + 'reactive_power',
                v: reactive_power.round(2),
            	u: 'VAr'
            });
        }
    }

    // Total active energy
    data.sensors.push({
        n: 'total_active_energy',
        v: total_ac_energy.round(2),
        u: 'kWh'
    });

    // Total reactive energy
    data.sensors.push({
        n: 'total_reactive_energy',
        v: total_re_energy.round(2),
        u: 'kVArh'
    });

    // B1
    if (mask >> 6 & 0x01) {
        data.sensors.push({
            n: 'b1_state',
            v: input.bytes[i++] ? 'CLOSED' : 'OPEN',
            u: 'bool'
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