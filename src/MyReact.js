const h = (type, props = {}, children = []) => ({
	type,
	props,
	children
});

export const createVDOM = (element, id = '.') => {
	const newElement = {
		...element,
		id,
		children: element.children.map((child, index) => createVDOM(child, `${id}${index}.`))
	};

	// Is this a component?
	if (typeof element.type === 'function') {
		// Call the component and pass in the props.
		// Returns the generated subtree
		const subtree = newElement.type(element.props);
    
		if (subtree.memoized) {
			return subtree;
		}
		// Call ourself recursively in order to assign the right ID
		// to the nodes and process any subcomponents in the subtree
		return createVDOM(subtree, id);
	}
	// If we come across an element that is not a function,
	// all we have to do is return it
	return newElement;
  
};