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
					switch (reply.type) {
						case "users":
							// display.setState({users: reply.data});
							app.users = reply.data;
							app.render();
							app.send({command: "slots", user: "all", data: null});
							break;
						case "slots":
							app.slots = reply.data;
							app.render();
							break;
						case "add":
							app.newSlot.id = reply.data;
							app.slots.push(app.newSlot);
							app.render();
							break;
						case "delete":
							app.slots = app.slots.filter(s => s.id != reply.data);
							app.render();
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
	for (var user of this.users) {
		userOptions[user.id] = `${user.firstName} ${user.lastName}`;
	}
	var userFilter = app.newSelect("slotUserFilter", "quarterWidth flexCenter", userOptions);
	var fromFilter = app.newTextInput("slotFromFilter", "quarterWidth flexCenter", "MM/DD/YY hh:mm:ss");
	var toFilter = app.newTextInput("slotToFilter", "quarterWidth flexCenter", "MM/DD/YY hh:mm:ss");
	var emptyButton = app.newElement("div", "slotSearchButton", "quarterWidth flexCenter", null);
	var searchButton = app.newElement("div", "slotSearchButton", "quarterWidth flexCenter", "Search");
	searchButton.addEventListener('click', this.requestSlots);
	var searchBar = app.newElement("div", null, "allWidth flexCenter");
	searchBar.append(userFilter, fromFilter, toFilter, emptyButton, searchButton);
	// slotList
	var tabs = app.newElement("div", null, "allWidth flexCenter");
	for (var t of ["User", "From", "To", "Comment", "Action"]) tabs.appendChild(app.newElement("div", null, "quarterWidth flexCenter", t));
	this.display.append(searchBar, tabs);
	for (var slot of this.slots) {
		// let user = this.users.find(u => u.id == slot.user);
		var userName = app.newElement("div", null, "quarterWidth flexCenter", userOptions[slot.user]);
		var fromField = app.newElement("div", null, "quarterWidth flexCenter", slot.from.toISOString().replace("T"," ").substring(0, 19));
		var toField = app.newElement("div", null, "quarterWidth flexCenter", slot.to.toLocaleString("de-DE"));
		var commentField = app.newElement("div", "slotSearchButton", "quarterWidth flexCenter", slot.text);
		var deleteButton = app.newElement("div", slot.id, "quarterWidth flexCenter", "-");
		deleteButton.addEventListener('click', this.deleteSlot);
		var slotBar = app.newElement("div", null, "allWidth flexCenter");
		slotBar.append(userName, fromField, toField, commentField, deleteButton);
		this.display.append(slotBar);
	}
	// addBar
	delete userOptions.all;
	var addUser = app.newSelect("addUserFilter", "quarterWidth flexCenter", userOptions);
	var addFrom = app.newTextInput("addFromFilter", "quarterWidth flexCenter", "MM/DD/YY hh:mm:ss");
	var addTo = app.newTextInput("addToFilter", "quarterWidth flexCenter", "MM/DD/YY hh:mm:ss");
	var addComment = app.newTextInput("addComment", "quarterWidth flexCenter", "add some...");
	var addButton = app.newElement("div", "addButton", "quarterWidth flexCenter", "Add");
	addButton.addEventListener('click', this.addSlot);
	var addBar = app.newElement("div", null, "allWidth flexCenter");
	addBar.append(addUser, addFrom, addTo, addComment, addButton);
	// statusBar
	var statusBar = app.newElement("div", "statusBar", "allWidth flexCenter");
	this.display.append(addBar, statusBar);
}

ApplicationObject.prototype.addSlot = function() {
	var user = document.getElementById('addUserFilter').value;
	var from = Date.parse(document.getElementById('addFromFilter').value);
	var to = Date.parse(document.getElementById('addToFilter').value);
	if (from & to) {
		var command = {command: "add", user: user, from: new Date(from), to: new Date(to), text: document.getElementById('addComment').value};
		app.newSlot = command;
		app.send(command);
	}
}

ApplicationObject.prototype.deleteSlot = function() {
	var command = {command: "delete", text: this.id, data: null};
	app.send(command);
}

ApplicationObject.prototype.requestSlots = function() {
	var command = {command: "slots", data: null};
	var user = document.getElementById('slotUserFilter').value;
	var from = Date.parse(document.getElementById('slotFromFilter').value);
	var to = Date.parse(document.getElementById('slotToFilter').value);
	if (user != "all") command.user = user;
	if (from) command.from = new Date(from);
	if (to) command.to = new Date(to);
	app.send(command);
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
    render() {
		return React.createElement('div', null, `Привет, ${this.props.toWhat}`);
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