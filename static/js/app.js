//
function ApplicationObject() {
	//contructor
	this.language = "en";
	this.users = [];
	this.slots = [];
}

ApplicationObject.prototype.send = function (request) {
	var xhr = new XMLHttpRequest();
	xhr.timeout = 30000;
	xhr.open('POST', "/xhr");
	xhr.send(JSON.stringify(request));
	console.log("Sending xhr", request);

	xhr.onload = function (e) {
		if (this.readyState === 4 && this.status === 200) {
			console.log(Math.round(this.responseText.length / 1024), 'Kbytes');
			var response = JSON.parse(this.responseText);
			console.log(response);
            switch (response.status) {
                case "ok":
                    console.log(response.data);
                    break;
                case "error":
                    throw new Error(response.error);
                    break;
                default:
                    throw new Error("Unimplemented error.");
            }
		} else {
			console.error(this.statusText);
			application.showMessageBox(this.statusText, resend);
		}
	}

	xhr.onerror = function (e) {
		console.error(e);
	}

	xhr.ontimeout = function (e) {
		console.error("A request timed out.");
	}
}

class Hello extends React.Component {
    render() {
      return React.createElement('div', null, `Привет, ${this.props.toWhat}`);
    }
}

//Init
var app = new ApplicationObject();

window.onload = function() {
	console.log("hello guys");
	app.send({command: "users", data: null});
	ReactDOM.render(
        React.createElement(Hello, {toWhat: 'мир'}, null),
        document.getElementById('appDisplay')
    );
}