
console.log("Connecting to https://luvit.io through proxy...");
connect("tls", "luvit.io", "443", function (write) {
  console.log("Connected to remote. Sending HTTP request...");
  write("GET / HTTP/1.1\r\nHost: luvit.io\r\n\r\n");
}, function (buffer) {
  console.log(buffer);
  console.log(toString(buffer));
});

function connect(protocol, host, port, onconnect, onmessage) {
  var socket = new WebSocket("wss://tedit.creationix.com/proxy/" + protocol + "/" + host + "/" + port);
  socket.binaryType = "arraybuffer";
  socket.onmessage = function (evt) {
    if (evt.data === "connect") {
      return onconnect(write);
    }
    if (typeof evt.data === "string") {
      console.log(evt.data);
    }
    else {
      onmessage(new Uint8Array(evt.data));
    }
  };
  function write(data) {
    return socket.send(data);
  }
  return write;
}

function toString(buffer) {
  var str = "";
  for (var i = 0, l = buffer.length; i < l; i++) {
    str += String.fromCharCode(buffer[i]);
  }
  // Decode UTF8
  return decodeURIComponent(escape(str));
}
