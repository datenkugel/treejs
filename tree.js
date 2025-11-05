/**
 * TreeJS is a JavaScript library for displaying TreeViews
 * on the web.
 *
 * @author Matthias Thalmann
 */

class TreeView {
    constructor(root, container = null, options = {}) {
        if (!root) {
            throw new Error("Parameter 1 must be set (root)");
        }

        if (!(root instanceof TreeNode)) {
            throw new Error("Parameter 1 must be of type TreeNode");
        }

        this.root = root;
        this.container = this._resolveContainer(container);
        // Note: This is a shallow copy. Nested objects will be shared by reference.
        // If you want a deep copy, consider using structuredClone or a deep copy utility.
        this.options = typeof structuredClone === "function" ? structuredClone(options) : { ...options };

        if (this.container) {
            this.reload();
        }
    }

    _resolveContainer(container) {
        if (!container) {
            return null;
        }

        if (TreeUtil.isDOM(container)) {
            return container;
        }

        const element = document.querySelector(container);
        if (!TreeUtil.isDOM(element)) {
            throw new Error("Parameter 2 must be either DOM-Object or CSS-QuerySelector (#, .)");
        }

        return element;
    }

    setRoot(newRoot) {
        if (newRoot instanceof TreeNode) {
            this.root = newRoot;
        }
    }

    getRoot() {
        return this.root;
    }

    expandAllNodes() {
        this.root.setExpanded(true);
        this.root.getChildren().forEach(child => TreeUtil.expandNode(child));
    }

    expandPath(path) {
        if (!(path instanceof TreePath)) {
            throw new Error("Parameter 1 must be of type TreePath");
        }

        path.getPath().forEach(node => node.setExpanded(true));
    }

    collapseAllNodes() {
        this.root.setExpanded(false);
        this.root.getChildren().forEach(child => TreeUtil.collapseNode(child));
    }

    setContainer(newContainer) {
        this.container = this._resolveContainer(newContainer);
    }

    getContainer() {
        return this.container;
    }

    setOptions(newOptions) {
        if (typeof newOptions === "object" && newOptions !== null && !Array.isArray(newOptions)) {
            this.options = { ...newOptions };
        }
    }

    changeOption(option, value) {
        this.options[option] = value;
    }

    getOptions() {
        return this.options;
    }

    setMultiSelect(active) {
        this.changeOption("multiSelect", Boolean(active));
    }

    setSelectedNodes(nodes) {
        nodes.forEach(n => {
            if (!(n instanceof TreeNode)) {
                throw new Error("Parameter 1 must be array containing only TreeNode objects");
            }
        });
        
        this.getSelectedNodes().forEach(n => n.setSelected(false));
        
        nodes.forEach(n => {
            n.setSelected(true);
            const pathNodes = new TreePath(this.getRoot(), n);
            pathNodes.getPath().forEach(e => e.setExpanded(true));
        });
    }

    // TODO: set selected key: up down; expand right; collapse left; enter: open;
    getSelectedNodes() {
        return TreeUtil.getSelectedNodesForNode(this.root);
    }

    reload() {
        if (!this.container) {
            console.warn("No container specified");
            return;
        }

        this.container.classList.add("tj_container");
        const cnt = document.createElement("ul");

        if (TreeUtil.getProperty(this.options, "show_root", true)) {
            cnt.appendChild(this._renderNode(this.root));
        } else {
            this.root.getChildren().forEach(child => {
                cnt.appendChild(this._renderNode(child));
            });
        }

        this.container.innerHTML = "";
        this.container.appendChild(cnt);
    }

    _renderNode(node) {
        const li_outer = document.createElement("li");
        const span_desc = document.createElement("span");
        span_desc.className = "tj_description";
        span_desc.tj_node = node;

        if (!node.isEnabled()) {
            li_outer.setAttribute("disabled", "");
            node.setExpanded(false);
            node.setSelected(false);
        }

        if (node.isSelected()) {
            span_desc.classList.add("selected");
        }

        span_desc.addEventListener("click", e => {
            let cur_el = e.target;

            while (!cur_el.tj_node && !cur_el.classList.contains("tj_container")) {
                cur_el = cur_el.parentElement;
            }

            const node_cur = cur_el.tj_node;
            if (!node_cur) return;

            if (node_cur.isEnabled()) {
                if (!e.ctrlKey) {
                    if (!node_cur.isLeaf()) {
                        node_cur.toggleExpanded();
                        this.reload();
                    } else {
                        node_cur.open();
                    }
                    node_cur.on("click")(e, node_cur);
                }

                if (e.ctrlKey && TreeUtil.getProperty(this.getOptions(), "multiSelect", true)) {
                    node_cur.toggleSelected();
                    this.reload();
                } else {
                    const rt = node_cur.getRoot();
                    if (rt instanceof TreeNode) {
                        TreeUtil.getSelectedNodesForNode(rt).forEach(nd => nd.setSelected(false));
                    }
                    node_cur.setSelected(true);
                    this.reload();
                }
            }
        });

        span_desc.addEventListener("contextmenu", e => {
            let cur_el = e.target;

            while (!cur_el.tj_node && !cur_el.classList.contains("tj_container")) {
                cur_el = cur_el.parentElement;
            }

            const node_cur = cur_el.tj_node;
            if (!node_cur) return;

            const contextHandler = node_cur.getListener("contextmenu");
            if (contextHandler) {
                node_cur.on("contextmenu")(e, node_cur);
                e.preventDefault();
            } else if (typeof TreeConfig.context_menu === "function") {
                TreeConfig.context_menu(e, node_cur);
                e.preventDefault();
            }
        });

        if (node.isLeaf() && !TreeUtil.getProperty(node.getOptions(), "forceParent", false)) {
            const iconHtml = this._getIconHtml(node, "leaf_icon");
            span_desc.innerHTML = iconHtml + node.toString();
            span_desc.classList.add("tj_leaf");
            li_outer.appendChild(span_desc);
        } else {
            const modIconHtml = node.isExpanded() 
                ? `<span class="tj_mod_icon">${TreeConfig.open_icon}</span>`
                : `<span class="tj_mod_icon">${TreeConfig.close_icon}</span>`;
            
            const iconHtml = this._getIconHtml(node, "parent_icon");
            span_desc.innerHTML = modIconHtml + iconHtml + node.toString();
            li_outer.appendChild(span_desc);

            if (node.isExpanded()) {
                const ul_container = document.createElement("ul");
                node.getChildren().forEach(child => {
                    ul_container.appendChild(this._renderNode(child));
                });
                li_outer.appendChild(ul_container);
            }
        }

        return li_outer;
    }

    _getIconHtml(node, iconType) {
        const nodeIcon = TreeUtil.getProperty(node.getOptions(), "icon", "");
        if (nodeIcon !== "") {
            return `<span class="tj_icon">${nodeIcon}</span>`;
        }
        
        const optionsIcon = TreeUtil.getProperty(this.options, iconType, "");
        if (optionsIcon !== "") {
            return `<span class="tj_icon">${optionsIcon}</span>`;
        }
        
        const defaultIcon = iconType === "leaf_icon" ? TreeConfig.leaf_icon : TreeConfig.parent_icon;
        return `<span class="tj_icon">${defaultIcon}</span>`;
    }
}

class TreeNode {
    constructor(userObject = "", options = {}) {
        if (userObject && typeof userObject !== "string" && typeof userObject.toString !== "function") {
            throw new Error("Parameter 1 must be of type String or Object, where it must have the function toString()");
        }

        this.userObject = userObject;
        this.children = [];
        this.events = new Map();
        this.options = { ...options };
        
        this.expanded = TreeUtil.getProperty(options, "expanded", true);
        this.enabled = TreeUtil.getProperty(options, "enabled", true);
        this.selected = TreeUtil.getProperty(options, "selected", false);
        this.parent = null;
    }

    addChild(node) {
        if (!TreeUtil.getProperty(this.options, "allowsChildren", true)) {
            console.warn("Option allowsChildren is set to false, no child added");
            return;
        }

        if (!(node instanceof TreeNode)) {
            throw new Error("Parameter 1 must be of type TreeNode");
        }

        this.children.push(node);
        node.parent = this;
    }

    removeChildPos(pos) {
        if (pos >= 0 && pos < this.children.length) {
            const removedChild = this.children[pos];
            this.children.splice(pos, 1);
            if (removedChild) {
                removedChild.parent = null;
            }
        }
    }

    removeChild(node) {
        if (!(node instanceof TreeNode)) {
            throw new Error("Parameter 1 must be of type TreeNode");
        }

        this.removeChildPos(this.getIndexOfChild(node));
    }

    getChildren() {
        return this.children;
    }

    getChildCount() {
        return this.children.length;
    }

    getIndexOfChild(node) {
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i].equals(node)) {
                return i;
            }
        }
        return -1;
    }

    getRoot() {
        let node = this;
        while (node.parent) {
            node = node.parent;
        }
        return node;
    }

    setUserObject(newUserObject) {
        if (typeof newUserObject !== "string" && (typeof newUserObject !== "object" || typeof newUserObject.toString !== "function")) {
            throw new Error("Parameter 1 must be of type String or Object, where it must have the function toString()");
        }
        this.userObject = newUserObject;
    }

    getUserObject() {
        return this.userObject;
    }

    setOptions(newOptions) {
        if (typeof newOptions === "object" && newOptions !== null) {
            this.options = { ...newOptions };
        }
    }

    changeOption(option, value) {
        this.options[option] = value;
    }

    getOptions() {
        return this.options;
    }

    isLeaf() {
        return this.children.length === 0;
    }

    setExpanded(newExpanded) {
        if (this.isLeaf() || typeof newExpanded !== "boolean") {
            return;
        }

        if (this.expanded === newExpanded) {
            return;
        }

        this.expanded = newExpanded;

        if (newExpanded) {
            this.on("expand")(this);
        } else {
            this.on("collapse")(this);
        }

        this.on("toggle_expanded")(this);
    }

    toggleExpanded() {
        this.setExpanded(!this.expanded);
    }

    isExpanded() {
        return this.isLeaf() ? true : this.expanded;
    }

    setEnabled(newEnabled) {
        if (typeof newEnabled !== "boolean" || this.enabled === newEnabled) {
            return;
        }

        this.enabled = newEnabled;

        if (newEnabled) {
            this.on("enable")(this);
        } else {
            this.on("disable")(this);
        }

        this.on("toggle_enabled")(this);
    }

    toggleEnabled() {
        this.setEnabled(!this.enabled);
    }

    isEnabled() {
        return this.enabled;
    }

    setSelected(newSelected) {
        if (typeof newSelected !== "boolean" || this.selected === newSelected) {
            return;
        }

        this.selected = newSelected;

        if (newSelected) {
            this.on("select")(this);
        } else {
            this.on("deselect")(this);
        }

        this.on("toggle_selected")(this);
    }

    toggleSelected() {
        this.setSelected(!this.selected);
    }

    isSelected() {
        return this.selected;
    }

    open() {
        if (!this.isLeaf()) {
            this.on("open")(this);
        }
    }

    on(ev, callback) {
        if (typeof callback === "undefined") {
            const handler = this.events.get(ev);
            return handler || (() => {});
        }

        if (typeof callback !== 'function') {
            throw new Error("Parameter 2 must be of type function/callback");
        }

        this.events.set(ev, callback);
    }

    getListener(ev) {
        return this.events.get(ev);
    }

    equals(node) {
        return node instanceof TreeNode && node.getUserObject() === this.userObject;
    }

    searchNode(key, needle) {
        if (typeof key !== "string") {
            throw new Error("Parameter 1 must be of type string");
        }
        if (typeof needle === "object" || typeof needle === "function") {
            throw new Error("Parameter 2 must be a scalar (string, int, bool, ...)");
        }

        for (const child of this.getChildren()) {
            const userObj = typeof child.getUserObject() === "string" ? {} : child.getUserObject();
            const optionValue = TreeUtil.getProperty(child.getOptions(), key, null);
            
            if (String(userObj[key]) === String(needle)) {
                return child;
            } else if (String(optionValue) === String(needle)) {
                return child;
            } else {
                const result = child.searchNode(key, needle);
                if (result) {
                    return result;
                }
            }
        }
        return null;
    }

    toString() {
        return typeof this.userObject === "string" 
            ? this.userObject 
            : this.userObject.toString();
    }
}

class TreePath {
    constructor(root, node) {
        this.nodes = [];
        this.separator = " - ";
        
        if (root instanceof TreeNode && node instanceof TreeNode) {
            this.setPath(root, node);
        }
    }

    setPath(root, node) {
        this.nodes = [];
        let currentNode = node;

        while (currentNode && !currentNode.equals(root)) {
            this.nodes.push(currentNode);
            currentNode = currentNode.parent;
        }

        if (currentNode && currentNode.equals(root)) {
            this.nodes.push(root);
        } else {
            this.nodes = [];
            throw new Error("Node is not contained in the tree of root");
        }

        this.nodes.reverse();
        return this.nodes;
    }

    getPath() {
        return this.nodes;
    }

    setSeparator(newSeparator) {
        if (typeof newSeparator !== "string") {
            throw new Error("Parameter 1 must be of type String");
        }
        this.separator = newSeparator;
    }

    toString() {
        return this.nodes.join(this.separator);
    }
}

/**
 * Utility methods for TreeJS
 */
const TreeUtil = {
    default_leaf_icon: "📄",
    default_parent_icon: "📁",
    default_open_icon: "⯆",
    default_close_icon: "⯈",

    isDOM(obj) {
        try {
            return obj instanceof HTMLElement;
        } catch (e) {
            return (typeof obj === "object") &&
                (obj?.nodeType === 1) && 
                (typeof obj?.style === "object") &&
                (typeof obj?.ownerDocument === "object");
        }
    },

    getProperty(options, opt, defaultValue) {
        if (options && (opt in options) && options[opt] !== undefined) {
            return options[opt];
        }
        return defaultValue;
    },

    expandNode(node) {
        node.setExpanded(true);
        if (!node.isLeaf()) {
            node.getChildren().forEach(child => TreeUtil.expandNode(child));
        }
    },

    collapseNode(node) {
        node.setExpanded(false);
        if (!node.isLeaf()) {
            node.getChildren().forEach(child => TreeUtil.collapseNode(child));
        }
    },

    getSelectedNodesForNode(node) {
        if (!(node instanceof TreeNode)) {
            throw new Error("Parameter 1 must be of type TreeNode");
        }

        const selected = [];

        if (node.isSelected()) {
            selected.push(node);
        }

        for (const child of node.getChildren()) {
            if (child.isSelected()) {
                selected.push(child);
            }

            if (!child.isLeaf()) {
                selected.push(...TreeUtil.getSelectedNodesForNode(child));
            }
        }

        return [...new Set(selected)]; // Remove duplicates
    },

    createTreeByFlatList(list, container, optId, optParentId) {
        if (!Array.isArray(list)) {
            throw new Error("Parameter 1 must be an array");
        }

        if (typeof optId !== "string") {
            throw new Error("Parameter 3 must be a string");
        }

        if (typeof optParentId !== "string") {
            throw new Error("Parameter 4 must be a string");
        }

        // Validate array structure
        let rootCount = 0;
        for (const item of list) {
            if (typeof item !== "object" || item === null) {
                throw new Error("Parameter 1 must be an array consisting of objects");
            }
            if (typeof item.toString !== "function") {
                throw new Error("Parameter 1 must be an array consisting of objects that have the toString() method");
            }
            if (!(optId in item)) {
                throw new Error(`Parameter 1 must be an array consisting of objects that have the property ${optId}`);
            }
            if (!(optParentId in item)) {
                throw new Error(`Parameter 1 must be an array consisting of objects that have the property ${optParentId}`);
            }
            if (item[optParentId] === null || item[optParentId] === "") {
                rootCount++;
            }
        }

        if (rootCount !== 1) {
            throw new Error("Parameter 1 must be an array consisting of objects, which only one has no parent");
        }

        // Build tree structure
        let root;
        const nodes = new Map();
        
        // Create all nodes first
        for (const item of list) {
            if (nodes.has(item[optId])) {
                throw new Error(`Parameter 1 must be an array consisting of objects that have the property '${optId}' whose value only exists once!`);
            }
            const options = item.options || {};
            nodes.set(item[optId], new TreeNode(item, options));
        }

        // Build parent-child relationships
        for (const item of list) {
            const node = nodes.get(item[optId]);
            if (item[optParentId] === null || item[optParentId] === "") {
                root = node;
            } else {
                const parent = nodes.get(item[optParentId]);
                if (parent) {
                    parent.addChild(node);
                }
            }
        }

        return new TreeView(root, container);
    }
};

/**
 * Global configuration for TreeJS
 */
const TreeConfig = {
    leaf_icon: TreeUtil.default_leaf_icon,
    parent_icon: TreeUtil.default_parent_icon,
    open_icon: TreeUtil.default_open_icon,
    close_icon: TreeUtil.default_close_icon,
    context_menu: undefined
};
