import { defineRule } from "oxlint/plugins";
import { getFunctionName, getEnclosingFunction } from "./no-inline-components.js";

/**
 * @typedef {import("oxlint/plugins").Context} RuleContext
 * @typedef {import("oxlint/plugins").ESTree.Node} ESTNode
 * @typedef {import("oxlint/plugins").ESTree.Function | import("oxlint/plugins").ESTree.ArrowFunctionExpression} FunctionLikeNode
 * @typedef {import("oxlint/plugins").ESTree.VariableDeclarator} VariableDeclaratorNode
 */

const FUNCTION_NODE_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

/**
 * @param {unknown} node
 * @returns {node is ESTNode & { type: string }}
 */
const isNode = (node) => Boolean(node && typeof node === "object" && "type" in node);

/**
 * @param {unknown} node
 * @returns {node is FunctionLikeNode}
 */
const isFunctionLike = (node) => isNode(node) && FUNCTION_NODE_TYPES.has(node.type);

/**
 * Checks if a node is a React Hook call (e.g., useState, useEffect, useCallback)
 * @param {ESTNode} node
 * @returns {boolean}
 */
const isReactHookCall = (node) => {
  if (node.type !== "CallExpression") return false;

  const callee = node.callee;
  if (!callee) return false;

  // Direct hook calls like useState()
  if (callee.type === "Identifier" && callee.name.startsWith("use")) {
    return true;
  }

  // React.useState(), React.useEffect(), etc.
  if (
    callee.type === "MemberExpression" &&
    callee.object &&
    callee.object.type === "Identifier" &&
    callee.object.name === "React" &&
    callee.property &&
    callee.property.type === "Identifier" &&
    callee.property.name.startsWith("use")
  ) {
    return true;
  }

  return false;
};

/**
 * Checks if a node contains JSX
 * @param {ESTNode} node
 * @returns {boolean}
 */
const containsJSX = (node) => {
  if (!node || !isNode(node)) return false;

  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !isNode(current)) continue;

    if (current.type === "JSXElement" || current.type === "JSXFragment") {
      return true;
    }

    // Don't traverse into nested functions
    if (isFunctionLike(current) && current !== node) {
      continue;
    }

    for (const key of Object.keys(current)) {
      if (key === "parent") continue;

      const value = current[key];
      if (!value) continue;

      if (Array.isArray(value)) {
        for (const element of value) {
          if (isNode(element)) {
            stack.push(element);
          }
        }
      } else if (isNode(value)) {
        stack.push(value);
      }
    }
  }

  return false;
};

/**
 * Checks if a function accesses variables from its enclosing scope
 * (excluding function parameters and locally declared variables)
 * @param {FunctionLikeNode} node
 * @param {Set<string>} localNames - Names of local variables and parameters
 * @returns {boolean}
 */
const accessesEnclosingScope = (node, localNames) => {
  if (!node.body) return false;

  const body = node.body;

  // For arrow functions with expression bodies
  if (body.type !== "BlockStatement") {
    return checkExpressionForScopeAccess(body, localNames);
  }

  // For block statements
  return checkNodeForScopeAccess(body, localNames);
};

/**
 * @param {ESTNode} node
 * @param {Set<string>} localNames
 * @returns {boolean}
 */
const checkNodeForScopeAccess = (node, localNames) => {
  if (!node || !isNode(node)) return false;

  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !isNode(current)) continue;

    // If we find an identifier reference, check if it's external
    if (current.type === "Identifier") {
      const parent = current.parent;

      // Skip if this identifier is part of a declaration
      if (
        parent &&
        isNode(parent) &&
        (parent.type === "VariableDeclarator" ||
          parent.type === "FunctionDeclaration" ||
          (parent.type === "Property" && parent.key === current))
      ) {
        continue;
      }

      // If the identifier is not in our local names, it's from enclosing scope
      if (!localNames.has(current.name)) {
        // Exclude global objects and common globals
        const globalNames = new Set([
          "console",
          "Math",
          "Date",
          "JSON",
          "Object",
          "Array",
          "String",
          "Number",
          "Boolean",
          "parseInt",
          "parseFloat",
          "isNaN",
          "isFinite",
          "undefined",
          "null",
          "true",
          "false",
          "Infinity",
          "NaN",
          "Map",
          "Set",
          "WeakMap",
          "WeakSet",
          "Promise",
          "Symbol",
          "Error",
          "TypeError",
          "ReferenceError",
          "SyntaxError",
        ]);

        if (!globalNames.has(current.name)) {
          return true;
        }
      }
    }

    // Don't traverse into nested functions
    if (isFunctionLike(current) && current !== node) {
      continue;
    }

    for (const key of Object.keys(current)) {
      if (key === "parent") continue;

      const value = current[key];
      if (!value) continue;

      if (Array.isArray(value)) {
        for (const element of value) {
          if (isNode(element)) {
            stack.push(element);
          }
        }
      } else if (isNode(value)) {
        stack.push(value);
      }
    }
  }

  return false;
};

/**
 * @param {ESTNode} node
 * @param {Set<string>} localNames
 * @returns {boolean}
 */
const checkExpressionForScopeAccess = (node, localNames) => {
  return checkNodeForScopeAccess(node, localNames);
};

/**
 * Collects all local variable names including parameters
 * @param {FunctionLikeNode} node
 * @returns {Set<string>}
 */
const collectLocalNames = (node) => {
  const names = new Set();

  // Add parameter names
  if (node.params) {
    for (const param of node.params) {
      collectPatternNames(param, names);
    }
  }

  // Add locally declared variables
  if (node.body && node.body.type === "BlockStatement") {
    for (const statement of node.body.body) {
      if (statement.type === "VariableDeclaration") {
        for (const declarator of statement.declarations) {
          collectPatternNames(declarator.id, names);
        }
      }
    }
  }

  return names;
};

/**
 * @param {import("oxlint").ESTree.Pattern} pattern
 * @param {Set<string>} names
 */
const collectPatternNames = (pattern, names) => {
  if (!pattern || !isNode(pattern)) return;

  if (pattern.type === "Identifier") {
    names.add(pattern.name);
    return;
  }

  if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements) {
      if (!element) continue;
      if (element.type === "RestElement") {
        collectPatternNames(element.argument, names);
      } else {
        collectPatternNames(element, names);
      }
    }
    return;
  }

  if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      if (!property) continue;
      if (property.type === "Property") {
        collectPatternNames(property.value, names);
      } else if (property.type === "RestElement") {
        collectPatternNames(property.argument, names);
      }
    }
    return;
  }

  if (pattern.type === "AssignmentPattern") {
    collectPatternNames(pattern.left, names);
    return;
  }

  if (pattern.type === "RestElement") {
    collectPatternNames(pattern.argument, names);
  }
};

/**
 * Checks if a function contains React Hook calls
 * @param {FunctionLikeNode} node
 * @returns {boolean}
 */
const containsHooks = (node) => {
  if (!node.body) return false;

  const stack = [node.body];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !isNode(current)) continue;

    if (isReactHookCall(current)) {
      return true;
    }

    // Don't traverse into nested functions
    if (isFunctionLike(current) && current !== node.body) {
      continue;
    }

    for (const key of Object.keys(current)) {
      if (key === "parent") continue;

      const value = current[key];
      if (!value) continue;

      if (Array.isArray(value)) {
        for (const element of value) {
          if (isNode(element)) {
            stack.push(element);
          }
        }
      } else if (isNode(value)) {
        stack.push(value);
      }
    }
  }

  return false;
};

/**
 * Checks if a function is wrapped in a React Hook (useCallback, useMemo, etc.)
 * @param {FunctionLikeNode} node
 * @returns {boolean}
 */
const isWrappedInHook = (node) => {
  const parent = node.parent;
  if (!parent || !isNode(parent)) return false;

  if (parent.type === "CallExpression" && isReactHookCall(parent)) {
    return true;
  }

  return false;
};

/**
 * Checks if a function is pure (doesn't access enclosing scope, hooks, or JSX)
 * @param {FunctionLikeNode} node
 * @returns {boolean}
 */
const isPureFunction = (node) => {
  // Must not contain JSX
  if (containsJSX(node)) return false;

  // Must not contain hooks
  if (containsHooks(node)) return false;

  // Must not be wrapped in a hook like useCallback or useMemo
  if (isWrappedInHook(node)) return false;

  // Must not access variables from enclosing scope (except globals)
  const localNames = collectLocalNames(node);
  if (accessesEnclosingScope(node, localNames)) return false;

  return true;
};

const rule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prevent declaring named pure functions inside other functions. Pure functions should be extracted to module scope for better performance and reusability.",
      recommended: false,
    },
    schema: [],
  },

  createOnce(context) {
    /**
     * @param {VariableDeclaratorNode} node
     */
    const handleVariableDeclarator = (node) => {
      // Only check arrow functions and function expressions
      const init = node.init;
      if (!init || !isFunctionLike(init)) return;

      // Must be named
      if (!node.id || node.id.type !== "Identifier") return;
      const functionName = node.id.name;

      // Get the enclosing function
      const enclosingFunction = getEnclosingFunction(node);
      if (!enclosingFunction) return;

      // Check if the inner function is pure
      if (!isPureFunction(init)) return;

      const enclosingFunctionName = getFunctionName(enclosingFunction);

      context.report({
        node: init,
        message: `Named pure function '${functionName}' should not be declared inside '${enclosingFunctionName}'. Extract it to module scope.`,
      });
    };

    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      VariableDeclarator(node) {
        if (node.type === "VariableDeclarator") handleVariableDeclarator(node);
      },
    });
  },
});

export const noNestedPureFunctionsRule = rule;
