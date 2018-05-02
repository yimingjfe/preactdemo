/* eslint-disable */
let rootInstance = null;

function render(element, container){
	let prevInstance = rootInstance;
	const newInstance = reconcile(container, element, prevInstance);
	rootInstance = newInstance
}

function reconcile(parentDom, element, prevInstance){
	if (!prevInstance){
		const newInstance = instantiate(element)
		parentDom.appendChild(newInstance.dom)
	} else {
		const newInstance = instantiate(element);
		parentDom.replaceChild(prevInstance.dom, newInstance);
	}
	return newInstance
}

function instantiate(element){
	const { props, type } = element

	const isTextElement = type === "TEXT ELEMENT";

	const dom = isTextElement 
		? document.createTextNode("")
		: document.createElement(type)


	const isListener = name => name.startsWith('on')
	const isAttribute = name => !isListener(name) && name != 'children'
	const isKey = name => name === 'key'
	const ischildren = name => name === 'children'

	Object.keys(props).filter(isListener).forEach(name => {
		dom.addEventListener(name, props[name])
	})

	Object.keys(props).filter(isAttribute).forEach(name => {
		dom.name = props[name]
	})

	let childrenInstances = props.children.map(instantiate)
	childrenInstances.forEach(childInstance => {
		dom.appendChild(childInstance.dom)
	})

	let instance = {dom: dom, children: childrenInstances}

	return instance
}

function createElement(type, attributes, children){

}