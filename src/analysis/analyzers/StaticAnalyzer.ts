import { BaseAnalyzer, AnalysisContext, AnalyzerResult } from './BaseAnalyzer';
import { IssueSeverity, IssueCategory, Issue } from '../../types';

/**
 * Static analyzer for basic code quality checks.
 */
export class StaticAnalyzer extends BaseAnalyzer {
  public readonly name = 'static';
  public readonly category = IssueCategory.SYNTAX;

  public async analyze(context: AnalysisContext): Promise<AnalyzerResult> {
    const issues: Issue[] = [];

    issues.push(...this.checkSyntaxErrors(context));
    issues.push(...this.checkConsoleStatements(context));
    issues.push(...this.checkTodoComments(context));
    issues.push(...this.checkAnyType(context));

    return { issues };
  }

  private checkSyntaxErrors(context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    const errorNodes = this.findNodes(context.rootNode, 'ERROR');

    for (const node of errorNodes) {
      issues.push(
        this.createIssue(
          IssueSeverity.ERROR,
          'Syntax error detected',
          'There is a syntax error. This will prevent the code from running.',
          this.nodeToLocation(node, context.filePath)
        )
      );
    }
    return issues;
  }

  private checkConsoleStatements(context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    const callNodes = this.findNodes(context.rootNode, 'call_expression');

    for (const node of callNodes) {
      const fnNode = node.childForFieldName('function');
      if (fnNode?.type === 'member_expression') {
        const obj = fnNode.childForFieldName('object');
        if (obj?.text === 'console') {
          issues.push(
            this.createIssue(
              IssueSeverity.INFO,
              'Console statement found',
              'Console statements should be removed before production.',
              this.nodeToLocation(node, context.filePath)
            )
          );
        }
      }
    }
    return issues;
  }

  private checkTodoComments(context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    const commentNodes = this.findNodes(context.rootNode, 'comment');

    for (const node of commentNodes) {
      const text = node.text.toUpperCase();
      if (text.includes('TODO')) {
        issues.push(
          this.createIssue(
            IssueSeverity.INFO,
            'TODO comment found',
            `Incomplete work: ${node.text.substring(0, 50)}...`,
            this.nodeToLocation(node, context.filePath)
          )
        );
      }
      if (text.includes('FIXME')) {
        issues.push(
          this.createIssue(
            IssueSeverity.WARNING,
            'FIXME comment found',
            `Known issue: ${node.text.substring(0, 50)}...`,
            this.nodeToLocation(node, context.filePath)
          )
        );
      }
    }
    return issues;
  }

  private checkAnyType(context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    if (!context.filePath.endsWith('.ts') && !context.filePath.endsWith('.tsx')) {
      return issues;
    }

    const typeAnnotations = this.findNodes(context.rootNode, 'type_annotation');
    for (const node of typeAnnotations) {
      const typeNode = node.children.find((c) => c.type === 'predefined_type');
      if (typeNode?.text === 'any') {
        issues.push(
          this.createIssue(
            IssueSeverity.WARNING,
            'Usage of "any" type',
            'Using "any" disables type checking. Consider using a more specific type.',
            this.nodeToLocation(typeNode, context.filePath)
          )
        );
      }
    }
    return issues;
  }
}
