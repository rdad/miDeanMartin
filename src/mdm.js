(function(ctx){

	const MODE_NOT_READY 				= -1;
	const MODE_READY 					= 0;
	const MODE_LEARN 					= 1;
	const MODE_MAPPING 					= 2;
	const MODE_PLAY 					= 3;

	var web_audio_api_is_supported 		= false,
		debug							= true,						
		midi_device 					= [],
		midi_interface 					= null,	
		mode 							= MODE_NOT_READY,
		data 							= {},
		callback 						= null,
		config 							= {
							normalize: false
		};

	var mideanmartin = {

		VERSION: 0.1,

		ready: function(ready_callback){

			console.log('Dean is ready to play !');

			if(web_audio_api_is_supported){
				ready_callback();
			}else{
				callback = ready_callback;
			}			
			return this;
		},

		start: function(){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');

			mode = MODE_PLAY;
			return this;
		},

		learn: function( callback ){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');

			data = {
				note: null,
				callback: null
			};
			mode = MODE_LEARN;
			if(callback)	data.callback = callback;

			clog('Dean is learning ...');
			return this;
		},


		// ----- MODE MAPPING -----
		
		capture: function( callback ){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');

			callback 	= callback;
			mode 		= MODE_CAPTURE;

			clog('Dean is ready to capturing all ...');
			return this;
		},

		map: function(device_name){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');

			var d = self.get_device(device_name);

			if(d){
				data = {
					device: d,
					control: null
				};
				mode = MODE_MAPPING;
				
				clog('Dean is mapping '+device_name+' ...');
			}else{
				clog("Dean doesn't known "+device_name+" ... personnaly");
			}
			
			return this;
		},

		control: function( code ){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');
			if(mode != MODE_MAPPING || !data.device)	return this;

			data.control = code;
			return this;
		},

		to: function( callback ){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');
			if(mode != MODE_MAPPING || !data.device || !data.control)	return this;

			data.device.map[data.control] 	= callback;
			data.device.mapped 				= true;			

			clog('Dean has binded '+data.control);
			data.control 					= null;

			return this;

		},

		then: function(then_callback){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');

			callback = then_callback;
			return this;
		},

		add_device: function(device){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');

			midi_device.push(device);
			clog('Dean found '+device.name+' ('+device.manufacturer+')');
			return this;
		},

		get_device: function(name){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');

			var nb = midi_device.length,
				j,
				result = null;

			for(j = 0; j<nb; j++){
				if(midi_device[j].name == name){
					result = midi_device[j];
					break; 
				}
			}

			if(!result)	clog('Dean has not found device '+name);
			return result;
		},

		get_interface: function(){

			if(!web_audio_api_is_supported)	clog('Dean has no midi device');

			return midi_interface;
		},

		normalize_value: function(){
			config.normalize = true;
			console.log('Value will be normalized he said');
			return this;
		}
	};

	var self 		= mideanmartin;
	ctx.mdm 		= mideanmartin;

	init();

	// --- private methods ---
	
	function clog( str ){
		console.log(str);
	}

	function init(){
			
		// MIDI Supported ?

		if (navigator.requestMIDIAccess) {

			navigator.requestMIDIAccess({
	        			sysex: false 
	    	}).then(function(midiAccess){

	    		web_audio_api_is_supported 	= true;
	    		midi_interface 				= midiAccess;

	    		clog('Dean says "MIDI is here to swing !"');
	    		prepare_midi_device();
	    		if(callback)	callback();

	    	}, function(e){
	    		clog('Dean says "No MIDI support in your browser man!"');
	    	});
		}
	}

	function prepare_midi_device(){

		if(!midi_interface)	return;

		for (var entry of midi_interface.inputs) {

			for(var j=1; j<entry.length; j++){			    
			    var device = new Device(entry[j]);
			    self.add_device(device);
			}
			
		}
	}

	/**
	 * Méthode qui reçoit les évènements venant des périphériques Midi
	 * @param  {MIDIMessageEvent } event 
	 * @return void
	 */
	function on_midi_message( MIDIMessageEvent ){

		// data.receivedTime;
		var data 	= MIDIMessageEvent.data;
		var device 	= MIDIMessageEvent.srcElement;

		var message = {
			//timestamp: MIDIMessageEvent.timeStamp,
			cmd: data[0] >> 4,
			channel: data[0] & 0xf,
			type: data[0] & 0xf0,
			note: data[1],
			velocity: data[2]
		};

		dispatch(message, device);
		if(debug)	clog(message);
		if(debug)	clog(device);
		//clog(MIDIMessageEvent);
	}


	function dispatch(message, device){

		switch(mode){

			case MODE_LEARN:

				if(data.note != message.note){
					data.note = message.note;
					clog('Dean has found controle '+data.note);
					if(data.callback)	data.callback(data.note);
				}
				break;
			
			case MODE_PLAY:

				var d 		= self.get_device(device.name),
					value 	= message.velocity;				
				if(!d || !d.mapped)	return;

				if(d.map[message.note]){
					if(config.normalize === true)	value = normalize_value(value);
					d.map[message.note](value);
				}
				break;

			case MODE_CAPTURE:
				callback(message, device);
				break;
				
		}
		//clog(message);
	}

	/**
	 * Normalize la valeur sur 1
	 * @param  Number value Valeur à normaliser
	 * @return Float       	Valeur normalizée
	 */
	function normalize_value(value){
		return value/127;
	}


	

	// --- Classe Device
	
	function Device( input ){

		this.id 			= input.id || 0;
		this.manufacturer 	= input.manufacturer || 'unknown';
		this.name 			= input.name || 'unknown';
		this.version 		= input.version || 0.0;
		this.interface 		= input;

		this.mapped 		= false;
		this.map 			= {};

		this.interface.onmidimessage = on_midi_message;
	}

})(window);