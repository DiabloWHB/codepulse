import { BaseAnalyzer, AnalysisContext, AnalyzerResult } from './BaseAnalyzer';
import { IssueSeverity, IssueCategory, Issue } from '../../types';
import { SyntaxNode } from '../Parser';

/**
 * Analyzes code for production readiness issues:
 * - Mock/dummy/fake data
 * - Inactive buttons (no onClick handlers)
 * - Broken event handlers
 * - Test data and placeholder values
 */
export class ProductionReadinessAnalyzer extends BaseAnalyzer {
  public readonly name = 'production-readiness';
  public readonly category = IssueCategory.SECURITY;

  // Patterns that indicate mock/test data
  private readonly mockPatterns = [
    /mock/i,
    /dummy/i,
    /fake/i,
    /test(?:Data|User|Api)/i,
    /placeholder/i,
    /sample/i,
    /example/i,
    /temp(?:orary)?/i
  ];

  // Common test/placeholder values
  private readonly testValues = [
    'test@example.com',
    'example.com',
    'john doe',
    'jane doe',
    'lorem ipsum',
    '123-456-7890',
    '(123) 456-7890',
    'password123',
    'admin',
    'user@test.com'
  ];

  public shouldAnalyze(context: AnalysisContext): boolean {
    // Analyze TSX/JSX files (React components)
    return context.filePath.endsWith('.tsx') || context.filePath.endsWith('.jsx');
  }

  public async analyze(context: AnalysisContext): Promise<AnalyzerResult> {
    const issues: Issue[] = [];

    issues.push(...this.checkMockVariables(context));
    issues.push(...this.checkMockValues(context));
    issues.push(...this.checkMockComments(context));
    issues.push(...this.checkInactiveButtons(context));
    issues.push(...this.checkBrokenHandlers(context));

    return { issues };
  }

  /**
   * Check for variable names that suggest mock/test data
   */
  private checkMockVariables(context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    const identifiers = this.findNodes(context.rootNode, 'identifier');

    for (const node of identifiers) {
      const name = node.text;

      // Check if name matches mock patterns
      for (const pattern of this.mockPatterns) {
        if (pattern.test(name)) {
          // Check if it's a variable declaration (not just any identifier)
          const parent = node.parent;
          if (parent?.type === 'variable_declarator' || parent?.type === 'property_declaration') {
            issues.push(
              this.createIssue(
                IssueSeverity.WARNING,
                'Mock/test data detected',
                `Variable '${name}' appears to be mock or test data. Replace with real data before production.`,
                this.nodeToLocation(node, context.filePath)
              )
            );
          }
          break;
        }
      }
    }

    return issues;
  }

  /**
   * Check for string literals that are common test values
   */
  private checkMockValues(context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    const strings = this.findNodes(context.rootNode, 'string');

    for (const node of strings) {
      const value = this.extractStringLiteral(node);
      if (!value) continue;

      if (this.testValues.some((testVal) => value.toLowerCase().includes(testVal.toLowerCase()))) {
        issues.push(
          this.createIssue(
            IssueSeverity.INFO,
            'Possible test value detected',
            `String literal contains common test value: "${value.substring(0, 50)}". Verify this is not placeholder data.`,
            this.nodeToLocation(node, context.filePath)
          )
        );
      }
    }

    return issues;
  }

  /**
   * Check for comments indicating temporary/mock code
   */
  private checkMockComments(context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    const patterns = [
      /todo.*replace.*real/i,
      /todo.*remove.*mock/i,
      /temporary/i,
      /placeholder/i,
      /mock\s+data/i,
      /fake\s+data/i,
      /for\s+testing/i,
      /not\s+real/i
    ];

    const lines = context.content.split('\n');
    lines.forEach((line, index) => {
      const comment = line.match(/\/\/\s*(.+)$|\/\*\s*(.+?)\s*\*\//);
      if (comment) {
        const commentText = (comment[1] || comment[2] || '').trim();
        for (const pattern of patterns) {
          if (pattern.test(commentText)) {
            issues.push(
              this.createIssue(
                IssueSeverity.WARNING,
                'Temporary code comment found',
                `Comment suggests incomplete work: "${commentText.substring(0, 80)}"`,
                {
                  file: context.filePath,
                  startLine: index,
                  endLine: index,
                  startColumn: 0,
                  endColumn: line.length
                }
              )
            );
            break;
          }
        }
      }
    });

    return issues;
  }

  /**
   * Check for inactive buttons (no onClick handler)
   */
  private checkInactiveButtons(context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    const jsxElements = this.findJSXElements(context.rootNode);

    for (const element of jsxElements) {
      const elementName = this.getJSXElementName(element);

      // Check if it's a button-like element
      if (
        elementName === 'button' ||
        elementName === 'Button' ||
        elementName?.endsWith('Button')
      ) {
        const hasOnClick = this.hasJSXAttribute(element, 'onClick');
        const hasDisabled = this.hasJSXAttribute(element, 'disabled');
        const hasType = this.getJSXAttributeValue(element, 'type');

        // Button without onClick and not disabled and not type="submit"
        if (!hasOnClick && !hasDisabled && hasType !== 'submit') {
          issues.push(
            this.createIssue(
              IssueSeverity.WARNING,
              'Inactive button detected',
              `Button element has no onClick handler. This button does nothing when clicked.`,
              this.nodeToLocation(element, context.filePath)
            )
          );
        }

        // Check for empty onClick
        if (hasOnClick) {
          const onClickValue = this.getJSXAttributeValue(element, 'onClick');
          if (!onClickValue || onClickValue === 'undefined' || onClickValue === '{}') {
            issues.push(
              this.createIssue(
                IssueSeverity.ERROR,
                'Broken button handler',
                `Button onClick handler is empty or undefined.`,
                this.nodeToLocation(element, context.filePath)
              )
            );
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check for broken event handlers that reference undefined functions
   */
  private checkBrokenHandlers(context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];

    // Find all defined function names in this file
    const definedFunctions = new Set<string>();
    const functionDecls = this.findNodes(context.rootNode, 'function_declaration');
    const arrowFuncs = this.findNodes(context.rootNode, 'arrow_function');

    for (const fn of functionDecls) {
      const nameNode = fn.childForFieldName('name');
      if (nameNode) definedFunctions.add(nameNode.text);
    }

    // For arrow functions assigned to variables
    for (const arrow of arrowFuncs) {
      const parent = arrow.parent;
      if (parent?.type === 'variable_declarator') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) definedFunctions.add(nameNode.text);
      }
    }

    // Now check onClick handlers
    const jsxElements = this.findJSXElements(context.rootNode);

    for (const element of jsxElements) {
      const onClick = this.getJSXAttributeValue(element, 'onClick');
      if (onClick && !onClick.includes('=>') && !onClick.includes('function')) {
        // It's a reference to a function name, not an inline function
        const functionName = onClick.replace(/[{}]/g, '').trim();

        if (functionName && !definedFunctions.has(functionName)) {
          // Check if it might be imported (simple heuristic)
          const isLikelyImported =
            context.content.includes(`import {`) && context.content.includes(functionName);

          if (!isLikelyImported) {
            issues.push(
              this.createIssue(
                IssueSeverity.ERROR,
                'Undefined function in event handler',
                `onClick references function '${functionName}' which is not defined in this file.`,
                this.nodeToLocation(element, context.filePath)
              )
            );
          }
        }
      }
    }

    return issues;
  }

  /**
   * Find all JSX elements in the tree
   */
  private findJSXElements(node: SyntaxNode): SyntaxNode[] {
    const elements: SyntaxNode[] = [];

    const traverse = (n: SyntaxNode): void => {
      if (n.type === 'jsx_element' || n.type === 'jsx_self_closing_element') {
        elements.push(n);
      }
      for (const child of n.children) {
        traverse(child);
      }
    };

    traverse(node);
    return elements;
  }

  /**
   * Get the name of a JSX element (e.g., "button", "Button")
   */
  private getJSXElementName(element: SyntaxNode): string | null {
    // For jsx_element: <button>...</button>
    const openingElement = element.children.find(
      (c) => c.type === 'jsx_opening_element' || c.type === 'jsx_self_closing_element'
    );

    if (openingElement) {
      const name = openingElement.children.find((c) => c.type === 'identifier');
      return name?.text || null;
    }

    // For jsx_self_closing_element: <Button />
    if (element.type === 'jsx_self_closing_element') {
      const name = element.children.find((c) => c.type === 'identifier');
      return name?.text || null;
    }

    return null;
  }

  /**
   * Check if JSX element has a specific attribute
   */
  private hasJSXAttribute(element: SyntaxNode, attrName: string): boolean {
    const attributes = element.children.filter((c) => c.type === 'jsx_attribute');

    for (const attr of attributes) {
      const name = attr.children.find((c) => c.type === 'property_identifier');
      if (name?.text === attrName) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the value of a JSX attribute
   */
  private getJSXAttributeValue(element: SyntaxNode, attrName: string): string | null {
    const attributes = element.children.filter((c) => c.type === 'jsx_attribute');

    for (const attr of attributes) {
      const name = attr.children.find((c) => c.type === 'property_identifier');
      if (name?.text === attrName) {
        const value = attr.children.find((c) => c.type === 'jsx_expression');
        if (value) {
          return value.text;
        }
      }
    }

    return null;
  }
}
