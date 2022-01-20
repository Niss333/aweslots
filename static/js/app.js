//
function ApplicationObject() {
	//contructor
	this.language = "en";
	this.display = document.getElementById("appDisplay");
	this.notifier = document.getElementById("appFooterRight");
	this.navigation = document.getElementById("navigation");
	this.controls = document.getElementById("controls");
	var tab = document.createElement("li"); tab.className = "navControl flexCenter"; tab.innerText = "Basics";
	this.navigation.appendChild(tab);
	this.users = [];
	this.slots = [];
	this.errorMessage = "Ok";
}

ApplicationObject.prototype.newElement = function(tag, id, className, html) {
	var e = document.createElement(tag);
	if (id) {e.id = id};
	if (className) {e.className = className};
	if (html) {e.innerHTML = html};
	return e;
}

ApplicationObject.prototype.newSelect = function(id, className, options = {}) {
	var select = this.newElement('select', id, className);
	for (var key of Object.keys(options)) {
		var option = document.createElement('option');
		option.value = key;
		option.text = options[key];
		select.add(option);
	}
	return select;
}

ApplicationObject.prototype.newTextInput = function(id, className, placeholder) {
	var input = this.newElement('input', id, className);
	input.type = "text";
	if (placeholder) {input.placeholder = placeholder;};
	return input;
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
			var reply = JSON.parse(this.responseText);
			console.log(reply);
            switch (reply.status) {
                case "ok":
                    console.log(reply.data);
					switch (reply.status) {
						case "users":
							// display.setState({users: reply.data});
							app.users = reply.data;
							app.render();
							break;
						case "slots":
							app.slots = reply.data;
							app.render();
							break;
						case "add":
							break;
						case "delete":
							break;
					}
                    break;
                case "error":
                    throw new Error(reply.error);
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

ApplicationObject.prototype.render = function () {
	while (this.display.firstChild) this.display.firstChild.remove();
	// this.display.querySelectorAll('*').forEach(n => n.remove());
	// searchBar
	var userOptions = {all: "All"};
	for (var user of this.state.users) {
		userOptions[user.id] = `${user.firstName} ${user.lastName}`;
	}
	var userSelect = app.newSelect("slotUserFilter", "quarterWidth flexCenter", userOptions);
	var fromSelect = app.newTextInput("slotFromFilter", "quarterWidth flexCenter");
	var toSelect = app.newTextInput("slotToFilter", "quarterWidth flexCenter");
	var searchButton = app.newElement("div", "slotSearchButton", "quarterWidth flexCenter");
	var searchBar = app.newElement("div", null, "allWidth flexCenter");
	searchBar.append(userSelect, fromSelect, toSelect, searchButton);
	// slotList
	// addBar
	// statusBar
	this.display.append(searchBar);
}

class BasicDisplay extends React.Component {
	constructor(props) {
	  super(props);
	  this.state = {users: [], slots: [], errorMessage: "Ok"};
	}
	componentDidMount() {
		app.send({command: "users", data: null});
	}
	componentWillUnmount() {}
	requestSlots() {
		app.send({command: "slots", data: null, user: document.getElementById('slotUserFilter').value});
	}
    render() {
		return <div>Привет, {this.props.toWhat}</div>;
	}
}

//Init
var app = new ApplicationObject();
// var display = React.createElement(BasicDisplay, {toWhat: 'мир'}, null);

window.onload = function() {
	console.log("hello guys");
	app.send({command: "users", data: null});
	// ReactDOM.render(display, app.display);
}