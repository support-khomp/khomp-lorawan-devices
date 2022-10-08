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
    var decoded = {};
  	var bytes = input.bytes;
    var decode_ver = bytes[i++];
  	var port = input.fPort;
    decoded.device = [];
    decoded.sensors = [];


    var model = {};
    model.n = 'model';
    model.u = 'string';
    switch (port) {
        case 16: model.v = "ITC 201"; break;
        case 17: model.v = "ITC 204"; break;
        case 18: model.v = "ITC 211"; break;
        case 19: model.v = "ITC 214"; break;
        default: model.v = "Unknow Model"; return decoded;
    }

    decoded.device.push(model);

    mask = (bytes[i++] << 8) | bytes[i++];

    // Firmware
    if (mask >> mask_index++ & 0x01) {
        var firmware = {};
        firmware.n = "firmware_version";
        firmware.v = (bytes[i] >> 4 & 0x0F) + '.' + (bytes[i++] & 0x0F) + '.';
        firmware.v += (bytes[i] >> 4 & 0x0F) + '.' + (bytes[i++] & 0x0F);
        firmware.u = 'string';
        decoded.device.push(firmware);
    }

    // battery
    if (mask >> mask_index++ & 0x01) {
        var battery = {};
        battery.n = 'battery';
        battery.v = ((bytes[i++] / 100.0) + 1).toFixed(2);
        battery.u = 'V';
        decoded.sensors.push(battery);
    }

    // Temperature
    if (mask >> mask_index++ & 0x01) {
        var temperature = {};
        temperature.n = 'temperature';
        temperature.v = (bytes[i++] / 2.0).toFixed(1);
        temperature.u = 'C';
        decoded.sensors.push(temperature);
    }

    // Humidity
    if (mask >> mask_index++ & 0x01) {
        var humidity = {};
        humidity.n = 'humidity';
        humidity.v = (bytes[i++] / 2.0).toFixed(1);
        humidity.u = '%';
        decoded.sensors.push(humidity);
    }

    // operation_mode
    if (mask >> mask_index++ & 0x01) {
        var operation_mode = {};
        var str_op_mode = ["Single flux",
            "Single flux and reflux",
            "Single flux and reflux digital",
            "Single flux and reflux quadrature",
            "Dual flux",
            "Dual flux and reflux",
            "Dual flux and reflux digital",
            "Dual flux and reflux quadrature",
            "Triple flux",
            "Quad flux"];
        operation_mode.n = 'operation_mode';
        operation_mode.v = str_op_mode[bytes[i++]];
        operation_mode.u = 'string';
        decoded.sensors.push(operation_mode);
    }

    if (decode_ver == 2) {
        // resolution
        if (mask >> mask_index++ & 0x01) {
            var resolution = {};
            var str_resolution = ["1", "10",
                "100", "1000", "10000"];
            resolution.n = 'resolution';
            resolution.v = str_resolution[bytes[i++]];
            resolution.u = 'L/pulse';
            decoded.sensors.push(resolution);
        }
    }

    // fraud_bit
    var fraud = {};
    fraud.n = 'fraud';
    fraud.u = 'string';
    if (mask >> mask_index++ & 0x01) {

        fraud.v = 'detected';
    }
    else {
        fraud.v = 'not detected';
    }

    decoded.sensors.push(fraud);

    // Counter Flux A
    if (mask >> mask_index++ & 0x01) {
        var counter_flux_a = {};
        counter_flux_a.n = 'counter_flux_a';
        counter_flux_a.v = ((bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | bytes[i++]);
        counter_flux_a.u = 'counter';
        decoded.sensors.push(counter_flux_a);
    }

    // Counter Flux B
    if (mask >> mask_index++ & 0x01) {
        var counter_flux_b = {};
        counter_flux_b.n = 'counter_flux_b';
        counter_flux_b.v = ((bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | bytes[i++]);
        counter_flux_b.u = 'counter';
        decoded.sensors.push(counter_flux_b);
    }

    // Counter Flux C
    if (mask >> mask_index++ & 0x01) {
        var counter_flux_c = {};
        counter_flux_c.n = 'counter_flux_c';
        counter_flux_c.v = ((bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | bytes[i++]);
        counter_flux_c.u = 'counter';
        decoded.sensors.push(counter_flux_c);
    }

    // Counter Flux D
    if (mask >> mask_index++ & 0x01) {
        var counter_flux_d = {};
        counter_flux_d.n = 'counter_flux_d';
        counter_flux_d.v = ((bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | bytes[i++]);
        counter_flux_d.u = 'counter';
        decoded.sensors.push(counter_flux_d);
    }

    // Counter Reflux A
    if (mask >> mask_index++ & 0x01) {
        var counter_reflux_a = {};
        counter_reflux_a.n = 'counter_reflux_a';
        counter_reflux_a.v = ((bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | bytes[i++]);
        counter_reflux_a.u = 'counter';
        decoded.sensors.push(counter_reflux_a);
    }

    // Counter Reflux B
    if (mask >> mask_index++ & 0x01) {
        var counter_reflux_b = {};
        counter_reflux_b.n = 'counter_reflux_b';
        counter_reflux_b.v = ((bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | bytes[i++]);
        counter_reflux_b.u = 'counter';
        decoded.sensors.push(counter_reflux_b);
    }

    // timestamp_sync
    var timestamp_sync = {};
    timestamp_sync.n = 'timestamp_sync';
    timestamp_sync.u = 'string';
    if (mask >> mask_index++ & 0x01) {

        timestamp_sync.v = 'syncronized';
    }
    else {
        timestamp_sync.v = 'not syncronized';
    }

    decoded.sensors.push(timestamp_sync);

    // Timestamp
    if (mask >> mask_index++ & 0x01) {
        var timestamp = {};
        timestamp.n = 'timestamp';
        timestamp.v = ((bytes[i++] << 24) | (bytes[i++] << 16) | (bytes[i++] << 8) | bytes[i++]);
        timestamp.u = 'seconds';
        decoded.sensors.push(timestamp);
    }

    // Counter insert alarm    
    if (mask >> mask_index++ & 0x01) {
        var counter_insert = {};
        counter_insert.n = 'counter_insert';
        counter_insert.u = 'string';
        counter_insert.v = 'alarm';
        decoded.sensors.push(counter_insert);
    } 
	data = decoded;
    return {data};
}
