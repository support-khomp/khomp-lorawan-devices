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
    let index_mask = 0;
    let decode_ver = input.bytes[i++];

    data.device = [];
    data.sensors = [];

    if (decode_ver == 1) {
        let model = { n: 'model', u: 'string' };
        if (input.fPort == 21) {
            model.v = "NIT 10LA";
        } else {
            model.v = "Unknown model";
            return { data };
        }

        data.device.push(model);

        mask = (input.bytes[i++] << 8) | input.bytes[i++];

        // Firmware
        if (mask >> index_mask++ & 0x01) {
            let firmware = { n: 'firmware_version', u: 'string' };
            firmware.v = (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F) + '.';
            firmware.v += (input.bytes[i] >> 4 & 0x0F) + '.' + (input.bytes[i++] & 0x0F);
            data.device.push(firmware);
        }

        // Temperature
        if (mask >> index_mask++ & 0x01) {
            let temperature = { n: 'temperature', u: 'C' };
            temperature.v = ((input.bytes[i++] << 8 | input.bytes[i++]) / 10.0).round(1);
            data.sensors.push(temperature);
        }

        // Humidity
        if (mask >> index_mask++ & 0x01) {
            let humidity = { n: 'humidity', u: '%' };
            humidity.v = ((input.bytes[i++] << 8 | input.bytes[i++]) / 10.0).round(1);
            data.sensors.push(humidity);
        }

        // PM_2_5
        if (mask >> index_mask++ & 0x01) {
            let pm2_5 = { n: 'pm2_5', u: 'ug/m^3' };
            pm2_5.v = (input.bytes[i++] << 8 | input.bytes[i++]);
            data.sensors.push(pm2_5);
        }

        // Noise
        if (mask >> index_mask++ & 0x01) {
            let noise = { n: 'noise', u: 'dB' };
            noise.v = ((input.bytes[i++] << 8 | input.bytes[i++]) / 10.0).round(1);
            data.sensors.push(noise);
        }

        // Air quality index pm2.5
        if (mask >> index_mask++ & 0x01) {
            let air_quality_index_pm2_5 = { n: 'air_quality_index_pm2_5', u: 'string' };
            const air_quality_index_text = ["good", "moderate", "unhealty", "very_unhealty", "hazardous"];
            air_quality_index_pm2_5.v = air_quality_index_text[input.bytes[i++]];
            data.sensors.push(air_quality_index_pm2_5);
        }
    }

    return { data };
}

Number.prototype.round = function (n) {
    const d = Math.pow(10, n);
    return Math.round((this + Number.EPSILON) * d) / d;
}