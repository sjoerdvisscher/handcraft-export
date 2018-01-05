{
	var transpose = 0;
	navigator.requestMIDIAccess().then(function(midiAccess) {
		var channel = 0;
		var channels = [];
		var noteOffs = {};
		var sustained = null;
		var inputs = midiAccess.inputs.values ?
				midiAccess.inputs.values() : midiAccess.inputs();
		for (var port of inputs) {
			console.log("Detected: " + port.name);
			if (port.name.indexOf("AXIS-49") > -1) {
				port.onmidimessage = function(evt) {
					console.log("Received: ", evt);
					switch (evt.data[0] & 0xF0) {
						case 0x90:
							var data = []
							for (var i = 0; i < evt.data.length; i++)
								data[i] = evt.data[i];
							var ix = data[1];
							if (ix == 7) {
								transpose--;
								return;
							}
							if (ix == 92) {
								transpose++;
								return;
							}
							var col = Math.floor((ix - 1) / 7);
							var isMinor = col % 2 == 1;
							var col2 = col >> 1;
							var row = (ix - 1) % 7;
							if (!isMinor && col > 7)
								row++;
							var note = whole * row + col2 * fourth + isMinor * major + minor +
									Math.round(transpose * octave / 4);
							if (output) {
								if (octave == 12) {
									channel = 0;
									channels[0] = null;
								}
								var note12 = (note / octave + (isMinor && just3rd) * justDelta) * 12 - 36;
								var note12rnd = Math.round(note12);
								var note12frac = Math.round((note12 - note12rnd) * 0x1000) + 0x2000;
								var toSend = channels[channel] ? [
									0x80 + channel,
									channels[channel],
									0
								] : [];
								if (noteOffs[ix])
									toSend = toSend.concat(noteOffs[ix]);
								if (sustained && sustained[ix]) {
									toSend = toSend.concat(sustained[ix]);
									delete sustained[ix];
								}
								toSend = toSend.concat([
									0xe0 + channel, 
									note12frac & 0x7f,
									(note12frac >> 7) & 0x7f
								]);
								channels[channel] = note12rnd + 72;
								toSend = toSend.concat([
									0x90 + channel,
									channels[channel],
									25 + data[2] / 2
								]);
								noteOffs[ix] = [
									0x80 + channel,
									channels[channel],
									0
								];
								console.log("Sending: ", toSend);
								output.send(toSend);
								channel++;
								if (channel == 16) channel = 0;
							} else {
								var freq = 523 * 
									Math.pow(2, note / octave + (isMinor && just3rd) * justDelta);
								playSound(freq, .2 + data[2] / 127 * .5);
							}
							break;
						case 0x80:
							var ix = evt.data[1];
							var noteOff = noteOffs[ix];
							if (noteOff) {
								if (sustained)
									sustained[ix] = noteOff;
								else
									output.send(noteOff);
							} 
							delete noteOffs[ix];
							break;
						default:
							//console.log(evt.data);
					}
				}
			} else {
				port.onmidimessage = function(evt) {
					switch (evt.data[0] & 0xF0) {
						case 0xB0: // Control change
							if (evt.data[1] == 64) { // Sustain
								if (evt.data[2] == 0) {
									for (var ix in sustained)
										output.send(sustained[ix]);
									sustained = null;
								} else {
									sustained = {};
								}
							}
							break;
						default:
							//console.log(evt.data);
					}
				}
			}
		}
		var output = null;
		var outputs = midiAccess.outputs.values ? 
				midiAccess.outputs.values() : midiAccess.outputs();
		for (var port of outputs)
			if (port.name.indexOf("IAC Bus 1") > -1)
				output = port;
	}, function(err) { console.error(err) });
	
	var args = location.search.substr(1).toLowerCase().split('&');
  var octave = parseInt(args[0]) || 12;
	if (args[0] == "ji")
		octave = 4296;
	var just3rd = location.search.toLowerCase().indexOf("j") > -1;

	function fromRatio(r) { return Math.round(Math.log(r)/Math.log(2) * octave) }
  var fifth = 1*args[2] || fromRatio(3/2);
  var major = 1*args[1] || fromRatio(5/4);
 
	var justDelta = Math.log(5/4)/Math.log(2) - major / octave;

	var cd = gcd(octave, gcd(fifth, major));
	if (cd != 1 && !args[1])
	{
		if (justDelta > 0) major++; else major--;
		var changed = "major";
		var other = octave / cd;
		cd = gcd(octave, gcd(fifth, major));
	  if (cd != 1)
		{
			major = fromRatio(5/4)
			fifth--; // only for 30 and 102?
  		var changed = "fifth";
		}
		alert("Shifted the " + 
					changed + 
					" interval to prevent the layout to be the same as " + 
					other);
	}
	var fourth = octave - fifth;
  var whole = fifth - fourth;
	var half = Math.floor(whole / 2) || 1;
	var quarter = Math.floor(half / 2) || 1;
	var majorScale = [0, whole, major, fourth, fifth, major + fourth, major + fifth, octave];	
	var minor = fifth - major;
	var minorScale = [0, whole, minor, fourth, fifth, minor + fourth, minor + fifth, octave];

	
	var circleNamesMaj = ["C", "F", "B", "E", "A", "D", "G", "C"]; 
	var circleNamesMin = ["e", "b", "f", "c", "g", "d", "a", "e"]; 
	var majors = [], minors = [];
	function setName(arr, i, name, mod, num, den) 
	{
		i = (i + octave * octave) % octave;
		name += sign(mod);
		if (!arr[i])
			arr[i] = { toString: function() { return name }, num: num, den: den, mod: mod };
	}
	function sign(c)
	{
		if (c == 0)
			return "";
		var s = "<b>♯</b>";
		if (c < 0) 
		{
			s = "<i>♭</i>";
			c = -c;
		}
		if (c == 1)
			return s;
	  if (c == 2)
			return s + s;
		return s + "<sup>" + c + "</sup>";
	}
	var comma = 4 * fifth - major;
	var octaveloop = octave / gcd(octave, fifth);
	if (octaveloop > 32)
		octaveloop = 1;
	function octDist(p) { return Math.min(p % octave, octave - (p % octave)) }
	for (var i = 0; i < octave; i++)
	{
		setName(majors, i * fifth, circleNamesMaj[7 - (i % 7)], Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i));
		setName(majors, i * fourth, circleNamesMaj[i % 7], -Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i));
		setName(minors, (i - 4) * fourth - comma, circleNamesMin[7 - (i % 7)], -Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4);
		setName(minors, (i + 4) * fifth - comma, circleNamesMin[i % 7], Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4);
		if (i > 0 && i < 32 && octDist(i * fifth) < octDist(octaveloop * fifth))
			octaveloop = i;
	}
	function gcd(a, b) 
	{
		if (b < 1) return a;
		return gcd(b, a % b);
	}

  var keyboard = document.getElementById("keyboard");
	var range = Math.min(42, 2 * octave);
  for (var y = -range; y <= range; y++)
  {
    var isMinor = y & 1 == 1;
		var noteY = 5 * octave - (y * whole - isMinor * (2 * major - whole)) / 2;
		var x0 = -Math.floor((noteY - octave * 2) / fourth);
    for (var x = x0; x <= octave * 7 / fourth + x0; x++)
    {
      var note = x * fourth + noteY;
      var pitchClass = note % octave;
      var box = keyboard.appendChild(document.createElement("div"));
      box.className = "key";
			var p = x * 2 + y * 2 + isMinor;
      var y2 = p * 17;
			var x2 = (note - isMinor * (major - fifth / 2)) / octave * 230;
      box.style.left = (x2 - 190) + "px";
      box.style.top = (1968 - y2) + "px";
			var nm = (isMinor ? minors : majors)[pitchClass];
			if (octave == 4296)
			{ 
				var num = nm.num;
				var den = nm.den;
				if (num && den)
				{
					while (num < den) num *= 2;
					while (num >= den * 2) den *= 2;
				  var g = gcd(num, den);
					num /= g; den /= g;
					pitchClass = num < 1000 
					? num + ":" + den 
					  : Math.round((Math.log(num / den) / Math.log(2) % 1) * 120000) / 100;
					note = Math.log(num / den) / Math.log(2) * octave + (note - (note % octave));
				}
			}
      box.innerHTML = (nm||"") + (octave != 12 ? "<sub>" + pitchClass + "</sub>" : "");
      box.style.backgroundColor = "hsl(" 
        + ((p * 180 / octaveloop) % 360) + ", 25%, "
			  + (((1500 - p * 30 / octaveloop) % 15) + 60) + "%)";
			box.freq = 523 * Math.pow(2, note / octave + (isMinor && just3rd) * justDelta - 6);
    }
  }
	
	var isDown = {}, freq = {};
	function ondown(e) {
		clearInterval(handler);
		
		var idx = e.identifier;
		isDown[idx] = true;
		onmove(e);
	}
	function onup(e) {
		var idx = e.identifier;
		delete isDown[idx];
		delete freq[idx];
	}
	function onmove(e) {
		var idx = e.identifier;
		if (!isDown[idx])
			return;
		for (
			var tgt = document.elementFromPoint(e.clientX, e.clientY); 
			tgt && !tgt.freq;
			tgt = tgt.parentNode
		) {}
		if (tgt && tgt.freq != freq[idx])
		{
		  freq[idx] = tgt.freq;
			playSound(freq[idx]);
		}
	}
	function initEventHandlers() {
		document.documentElement.onmousedown = ondown;
		document.documentElement.onmouseup = onup;
		document.documentElement.onmousemove = onmove;
		document.documentElement.ontouchstart = function(e) {
			if (e.target.nodeName.toLowerCase() == "a")
				return;

			for (var i = 0; i < e.changedTouches.length; i++)
			{
				var t = e.changedTouches[i];
				var w = window.innerWidth;
				var h = window.innerHeight;
				var r = Math.min(w, h) / 3;
				var d = t.clientX - t.clientY;
				if (d < w - r && -d < h - r)
					e.preventDefault();

				ondown(t);
			}
		}
		document.documentElement.ontouchmove = function(e) {
			for (var i = 0; i < e.changedTouches.length; i++)
				onmove(e.changedTouches[i]);
		}
		document.documentElement.ontouchend = function(e) {
			for (var i = 0; i < e.changedTouches.length; i++)
				onup(e.changedTouches[i]);
		}
	}

	function scrollCenter() {
		window.scrollTo(1000 - window.innerWidth / 2, 2000 - window.innerHeight / 2);
	}
	var handler = setInterval(scrollCenter, 100);
	
	document.getElementById("close-features").onclick = 
  document.getElementById("features").onclick = 
	function(e) 
  {
		playSound(400);
		initEventHandlers()
		clearInterval(handler);
		scrollCenter();
		if (e.target.nodeName.toLowerCase() == "a")
			return;
		document.getElementById("features").style.visibility = "hidden";
  }
}