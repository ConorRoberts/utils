import { defineRule } from "oxlint";

/**
 * @typedef {import("oxlint").Context} RuleContext
 * @typedef {import("oxlint").ESTree.Node} ESTNode
 * @typedef {import("oxlint").ESTree.Expression} ESTExpression
 * @typedef {import("oxlint").ESTree.Pattern} ESTPattern
 * @typedef {import("oxlint").ESTree.ReturnStatement} ReturnStatementNode
 * @typedef {import("oxlint").ESTree.VariableDeclarator} VariableDeclaratorNode
 * @typedef {import("oxlint").ESTree.AssignmentExpression} AssignmentExpressionNode
 * @typedef {import("oxlint").ESTree.Function | import("oxlint").ESTree.ArrowFunctionExpression} FunctionLikeNode
 */

/**
 * @typedef {object} RecordedAssignment
 * @property {ESTExpression} node
 * @property {string[]} names
 */

/**
 * @typedef {object} NestedFunctionRecord
 * @property {FunctionLikeNode} node
 * @property {string} name
 */

/**
 * @typedef {object} FunctionContext
 * @property {FunctionLikeNode} node
 * @property {FunctionContext | null} parent
 * @property {string} name
 * @property {boolean} returnsJsx
 * @property {Set<string>} jsxBindingNames
 * @property {RecordedAssignment[]} jsxAssignments
 * @property {NestedFunctionRecord[]} nestedJsxChildren
 */

const JSX_NODE_TYPES = new Set(["JSXElement", "JSXFragment"]);
const FUNCTION_NODE_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

/**
 * @param {unknown} name
 * @returns {name is string}
 */
export const isComponentName = (name) => typeof name === "string" && /^[A-Z]/.test(name);

/**
 * @param {unknown} name
 * @returns {name is string}
 */
export const isHookName = (name) => typeof name === "string" && name.startsWith("use");

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
 * @param {ESTNode | null | undefined} node
 * @returns {FunctionLikeNode | null}
 */
export const getEnclosingFunction = (node) => {
  const findFunction = (current) => {
    if (!current) return null;
    if (isFunctionLike(current)) {
      return current;
    }
    return findFunction(isNode(current) ? current.parent ?? null : null);
  };
  return findFunction(isNode(node) ? node.parent ?? null : null);
};

/**
 * @param {FunctionLikeNode} node
 */
const isFunctionUsedAsJsxProp = (node) => {
  const checkJsxProp = (current) => {
    if (!current) return false;
    if (current.type === "JSXAttribute") {
      return true;
    }
    if (isFunctionLike(current)) {
      return false;
    }
    return checkJsxProp(isNode(current) ? current.parent ?? null : null);
  };
  return checkJsxProp(isNode(node) ? node.parent ?? null : null);
};

/**
 * @param {FunctionLikeNode} node
 */
const isFunctionImmediatelyInvoked = (node) => {
  const parent = isNode(node) ? node.parent ?? null : null;
  if (!parent) return false;

  // Check if the function is the callee of a CallExpression (i.e., it's immediately invoked)
  if (parent.type === "CallExpression" && parent.callee === node) {
    return true;
  }

  return false;
};

/**
 * @param {ESTExpression | null | undefined} root
 */
const expressionContainsJsx = (root) => {
  if (!root || !isNode(root)) return false;

  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !isNode(current)) continue;

    if (JSX_NODE_TYPES.has(current.type)) {
      return true;
    }

    if (FUNCTION_NODE_TYPES.has(current.type) && current !== root) {
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
 * @param {ESTExpression | null | undefined} root
 * @param {Set<string>} bindingNames
 */
const expressionProducesJsx = (root, bindingNames) => {
  if (!root) return false;
  if (expressionContainsJsx(root)) return true;

  if (!isNode(root)) return false;

  const type = root.type;

  if (type === "Identifier") {
    return bindingNames.has(root.name);
  }

  if (type === "ConditionalExpression") {
    return expressionProducesJsx(root.consequent, bindingNames) || expressionProducesJsx(root.alternate, bindingNames);
  }

  if (type === "LogicalExpression") {
    return expressionProducesJsx(root.left, bindingNames) || expressionProducesJsx(root.right, bindingNames);
  }

  if (type === "SequenceExpression") {
    const expressions = root.expressions ?? [];
    const last = expressions[expressions.length - 1] ?? null;
    return expressionProducesJsx(last, bindingNames);
  }

  if (type === "ArrayExpression") {
    return root.elements.some((element) => {
      if (!element) return false;
      if (element.type === "SpreadElement") {
        return expressionProducesJsx(element.argument, bindingNames);
      }
      return expressionProducesJsx(element, bindingNames);
    });
  }

  if (type === "ParenthesizedExpression") {
    return expressionProducesJsx(root.expression, bindingNames);
  }

  if (type === "AwaitExpression" || type === "UnaryExpression" || type === "UpdateExpression") {
    return expressionProducesJsx(root.argument, bindingNames);
  }

  if (
    type === "TSAsExpression" ||
    type === "TSTypeAssertion" ||
    type === "TSNonNullExpression" ||
    type === "ChainExpression"
  ) {
    return expressionProducesJsx(root.expression, bindingNames);
  }

  if (type === "CallExpression") {
    return expressionProducesJsx(root.callee, bindingNames);
  }

  if (type === "MemberExpression") {
    return expressionProducesJsx(root.object, bindingNames);
  }

  return false;
};

/**
 * @param {ESTPattern | null | undefined} pattern
 * @param {string[]} names
 */
const collectBindingNames = (pattern, names) => {
  if (!pattern || !isNode(pattern)) return;

  const type = pattern.type;

  if (type === "Identifier") {
    names.push(pattern.name);
    return;
  }

  if (type === "ArrayPattern") {
    for (const element of pattern.elements) {
      if (!element) continue;
      if (element.type === "RestElement") {
        collectBindingNames(element.argument, names);
      } else {
        collectBindingNames(element, names);
      }
    }
    return;
  }

  if (type === "ObjectPattern") {
    for (const property of pattern.properties) {
      if (!property) continue;
      if (property.type === "Property") {
        collectBindingNames(property.value, names);
      } else if (property.type === "RestElement") {
        collectBindingNames(property.argument, names);
      }
    }
    return;
  }

  if (type === "AssignmentPattern") {
    collectBindingNames(pattern.left, names);
    return;
  }

  if (type === "RestElement") {
    collectBindingNames(pattern.argument, names);
  }
};

/**
 * @param {FunctionLikeNode} node
 */
export const getFunctionName = (node) => {
  if (node.type === "FunctionDeclaration" && node.id && node.id.type === "Identifier") {
    return node.id.name;
  }

  if ((node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") && node.id) {
    if (node.id.type === "Identifier") return node.id.name;
  }

  const parent = node.parent;
  if (!parent || !isNode(parent)) return "";

  if (parent.type === "VariableDeclarator") {
    return parent.id && parent.id.type === "Identifier" ? parent.id.name : "";
  }

  if (parent.type === "AssignmentExpression") {
    return parent.left && parent.left.type === "Identifier" ? parent.left.name : "";
  }

  if (parent.type === "Property" || parent.type === "MethodDefinition") {
    return parent.key && parent.key.type === "Identifier" ? parent.key.name : "";
  }

  // Handle functions passed as arguments to calls (e.g., useCallback, useMemo)
  if (parent.type === "CallExpression") {
    const callParent = parent.parent;
    if (callParent && isNode(callParent)) {
      if (callParent.type === "VariableDeclarator") {
        return callParent.id && callParent.id.type === "Identifier" ? callParent.id.name : "";
      }
      if (callParent.type === "AssignmentExpression") {
        return callParent.left && callParent.left.type === "Identifier" ? callParent.left.name : "";
      }
    }
  }

  return "";
};

/**
 * @param {string} name
 */
const describeFunction = (name) => (name ? `function '${name}'` : "this function");

/**
 * @param {string} name
 */
const describeNested = (name) => (name ? `function '${name}'` : "an anonymous function");

/**
 * @param {string[]} names
 * @param {string} fnName
 */
const createAssignmentMessage = (names, fnName) => {
  const target =
    names.length === 0
      ? "local variables"
      : names.length === 1
        ? `local '${names[0]}'`
        : `locals ${names.map((name) => `'${name}'`).join(", ")}`;

  return `Avoid storing JSX in ${target} inside ${describeFunction(fnName)}; return the JSX directly instead.`;
};

/**
 * @param {string} childName
 * @param {string} parentName
 */
const createNestedFunctionMessage = (childName, parentName) =>
  `JSX-returning ${describeNested(childName)} should not be declared inside ${describeFunction(parentName)}. Extract it to module scope.`;

/**
 * @param {string} name
 */
const createIIFEMessage = (name) =>
  `JSX-returning ${describeNested(name)} should not be declared as an immediately invoked function expression (IIFE). Extract it to a named function at module scope.`;

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow JSX-returning functions and JSX-valued assignments within other functions that also return JSX.",
      recommended: false,
    },
    schema: [],
  },

  createOnce(context) {
    /** @type {FunctionContext[]} */
    const functionStack = [];

    const currentFunction = () => functionStack[functionStack.length - 1] ?? null;

    /**
     * @param {FunctionLikeNode} node
     */
    const enterFunction = (node) => {
      const parent = currentFunction();
      /** @type {FunctionContext} */
      const fnCtx = {
        node,
        parent,
        name: getFunctionName(node),
        returnsJsx: false,
        jsxBindingNames: new Set(),
        jsxAssignments: [],
        nestedJsxChildren: [],
      };

      functionStack.push(fnCtx);

      if (node.type === "ArrowFunctionExpression" && node.body && node.body.type !== "BlockStatement") {
        if (expressionProducesJsx(node.body, fnCtx.jsxBindingNames)) {
          fnCtx.returnsJsx = true;
        }
      }
    };

    const exitFunction = () => {
      const fnCtx = functionStack.pop();
      if (!fnCtx) return;

      if (fnCtx.returnsJsx && isFunctionImmediatelyInvoked(fnCtx.node)) {
        context.report({
          node: fnCtx.node,
          message: createIIFEMessage(fnCtx.name),
        });
        return;
      }

      if (fnCtx.parent && fnCtx.returnsJsx && fnCtx.name && !isFunctionUsedAsJsxProp(fnCtx.node)) {
        fnCtx.parent.nestedJsxChildren.push({ node: fnCtx.node, name: fnCtx.name });
      }

      if (!fnCtx.returnsJsx) return;

      for (const assignment of fnCtx.jsxAssignments) {
        context.report({
          node: assignment.node,
          message: createAssignmentMessage(assignment.names, fnCtx.name),
        });
      }

      for (const nested of fnCtx.nestedJsxChildren) {
        context.report({
          node: nested.node,
          message: createNestedFunctionMessage(nested.name, fnCtx.name),
        });
      }
    };

    /** @param {ReturnStatementNode} node */
    const handleReturnStatement = (node) => {
      const fnCtx = currentFunction();
      if (!fnCtx) return;

      const argument = node.argument;
      if (!argument || isFunctionLike(argument)) return;

      if (expressionProducesJsx(argument, fnCtx.jsxBindingNames)) {
        fnCtx.returnsJsx = true;
      }
    };

    /** @param {VariableDeclaratorNode} node */
    const handleVariableDeclarator = (node) => {
      const fnCtx = currentFunction();
      if (!fnCtx) return;

      const init = node.init;
      if (!init || isFunctionLike(init)) return;
      if (!expressionContainsJsx(init)) return;

      const names = [];
      collectBindingNames(node.id, names);
      for (const name of names) {
        fnCtx.jsxBindingNames.add(name);
      }

      fnCtx.jsxAssignments.push({ node: init, names });
    };

    /** @param {AssignmentExpressionNode} node */
    const handleAssignmentExpression = (node) => {
      if (node.operator !== "=") return;

      const fnCtx = currentFunction();
      if (!fnCtx) return;

      const right = node.right;
      if (!right || isFunctionLike(right)) return;
      if (!expressionContainsJsx(right)) return;

      const names = [];
      if (node.left && node.left.type === "Identifier") {
        names.push(node.left.name);
        fnCtx.jsxBindingNames.add(node.left.name);
      }

      fnCtx.jsxAssignments.push({ node: right, names });
    };

    /**
     * @param {import("oxlint").ESTree.CallExpression} node
     */
    const handleCallExpression = (node) => {
      const fnCtx = currentFunction();
      if (!fnCtx) return;

      // Check for array.push(<JSX>)
      if (
        node.callee &&
        node.callee.type === "MemberExpression" &&
        node.callee.property &&
        node.callee.property.type === "Identifier" &&
        node.callee.property.name === "push"
      ) {
        const arrayObject = node.callee.object;
        if (arrayObject && arrayObject.type === "Identifier") {
          const arrayName = arrayObject.name;

          // Check if any argument contains JSX
          const hasJsxArgument = node.arguments.some((arg) => {
            if (!arg || arg.type === "SpreadElement") return false;
            return expressionContainsJsx(arg);
          });

          if (hasJsxArgument) {
            fnCtx.jsxBindingNames.add(arrayName);
            fnCtx.jsxAssignments.push({ node: node, names: [arrayName] });
          }
        }
      }
    };

    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      FunctionDeclaration(node) {
        if (isFunctionLike(node)) enterFunction(node);
      },
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression(node) {
        if (isFunctionLike(node)) enterFunction(node);
      },
      "FunctionExpression:exit": exitFunction,
      ArrowFunctionExpression(node) {
        if (isFunctionLike(node)) enterFunction(node);
      },
      "ArrowFunctionExpression:exit": exitFunction,
      ReturnStatement(node) {
        if (node.type === "ReturnStatement") handleReturnStatement(node);
      },
      VariableDeclarator(node) {
        if (node.type === "VariableDeclarator") handleVariableDeclarator(node);
      },
      AssignmentExpression(node) {
        if (node.type === "AssignmentExpression") handleAssignmentExpression(node);
      },
      CallExpression(node) {
        if (node.type === "CallExpression") handleCallExpression(node);
      },
    });
  },
});

export const noInlineComponentsRule = rule;

export default {
  meta: { name: "no-inline-components" },
  rules: { "no-inline-components": rule },
};
