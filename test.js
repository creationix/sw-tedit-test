// See http(s) section in https://git-scm.com/book/en/v2/Git-Internals-Transfer-Protocols
run(function* () {
  console.log("Connecting to git repo through proxy...");
  var socket = yield* connect("tls", "github.com", "443");
  console.log("Connected to remote. Sending HTTP request...");
  var path = "/creationix/conquest.git/info/refs?service=git-upload-pack";
  var request = "GET " + path + " HTTP/1.1\r\nHost: github.com\r\n\r\n";
  yield* socket.write(request);

//  yield* sleep(200);
  do {
    var chunk = yield* socket.read();
    console.log(chunk);
    console.log(toString(chunk));
  } while (chunk);
});

function* sleep(ms) {
  yield function (cb) {
    setTimeout(cb, ms);
  };
}


function* connect(protocol, host, port) {
  var socket = new WebSocket("wss://tedit.creationix.com/proxy/" + protocol + "/" + host + "/" + port);
  socket.binaryType = "arraybuffer";
  var pending;
  var buffer = [];
  yield function (cb) {
    socket.onmessage = function (evt) {
      if (evt.data === "connect") {
        return cb();
      }
      if (typeof evt.data === "string") {
        console.log(evt.data);
      }
      else {
        buffer.push(evt.data);
        if (pending) flush();
      }
    };
  };

  return {
    read: read,
    write: write,
  };

  function flush() {
    var cb = pending;
    pending = null;
    var data;
    if (buffer.length === 1) {
      data = new Uint8Array(buffer[0]);
    }
    else {
      var count = 0;
      var i, l;
      for (i = 0, l = buffer.length; i < l; i++) {
        count += buffer[i].byteLength;
      }
      data = new ArrayBuffer(count);
      count = 0;
      for (i = 0, l = buffer.length; i < l; i++) {
        var src = new Uint8Array(buffer[i]);
        var dst = new Uint8Array(data, count, src.length);
        dst.set(src);
        count += src.length;
      }
      data = new Uint8Array(data);
    }
    buffer.length = 0;
    cb(null, data);
  }

  function* write(data) {
    return socket.send(data);
  }
  function* read() {
    return yield function (cb) {
      pending = cb;
      if (buffer.length) { flush(); }
    };
  }
}

function toString(buffer) {
  var str = "";
  for (var i = 0, l = buffer.length; i < l; i++) {
    str += String.fromCharCode(buffer[i]);
  }
  // Decode UTF8
  return decodeURIComponent(escape(str));
}


////////////////////////////// gen run //////////////////////

function run(generator, callback) {
  var iterator;
  if (typeof generator === "function") {
    // Pass in resume for no-wrap function calls
    iterator = generator(resume);
  }
  else if (typeof generator === "object") {
    // Oterwise, assume they gave us the iterator directly.
    iterator = generator;
  }
  else {
    throw new TypeError("Expected generator or iterator and got " + typeof generator);
  }

  var data = null, yielded = false;

  var next = callback ? nextSafe : nextPlain;

  next();
  check();

  function nextSafe(err, item) {
    var n;
    try {
      n = (err ? iterator.throw(err) : iterator.next(item));
      if (!n.done) {
        if (n.value) start(n.value);
        yielded = true;
        return;
      }
    }
    catch (err) {
      return callback(err);
    }
    return callback(null, n.value);
  }

  function nextPlain(err, item) {
    var cont = (err ? iterator.throw(err) : iterator.next(item)).value;
    if (cont) start(cont);
    yielded = true;
  }

  function start(cont) {
    // Pass in resume to continuables if one was yielded.
    if (typeof cont === "function") return cont(resume());
    // If an array of continuables is yielded, run in parallel
    var i, l;
    if (Array.isArray(cont)) {
      for (i = 0, l = cont.length; i < l; ++i) {
        if (typeof cont[i] !== "function") return;
      }
      return parallel(cont, resume());
    }
    // Also run hash of continuables in parallel, but name results.
    if (typeof cont === "object" && Object.getPrototypeOf(cont) === Object.prototype) {
      var keys = Object.keys(cont);
      for (i = 0, l = keys.length; i < l; ++i) {
        if (typeof cont[keys[i]] !== "function") return;
      }
      return parallelNamed(keys, cont, resume());
    }
  }

  function resume() {
    var done = false;
    return function () {
      if (done) return;
      done = true;
      data = arguments;
      check();
    };
  }

  function check() {
    while (data && yielded) {
      var err = data[0];
      var item = data[1];
      data = null;
      yielded = false;
      next(err, item);
      yielded = true;
    }
  }

}

function parallel(array, callback) {
  var length = array.length;
  var left = length;
  var results = new Array(length);
  var done = false;
  return array.forEach(function (cont, i) {
    cont(function (err, result) {
      if (done) return;
      if (err) {
        done = true;
        return callback(err);
      }
      results[i] = result;
      if (--left) return;
      done = true;
      return callback(null, results);
    });
  });
}

function parallelNamed(keys, obj, callback) {
  var length = keys.length;
  var left = length;
  var results = {};
  var done = false;
  return keys.forEach(function (key) {
    var cont = obj[key];
    results[key] = null;
    cont(function (err, result) {
      if (done) return;
      if (err) {
        done = true;
        return callback(err);
      }
      results[key] = result;
      if (--left) return;
      done = true;
      return callback(null, results);
    });
  });
}
