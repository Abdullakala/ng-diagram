import { inject, Injectable } from '@angular/core';
import {
  Edge,
  NgDiagramModelService,
  NgDiagramNodeService,
  NgDiagramSelectionService,
  NgDiagramService,
  NgDiagramViewportService,
  Node,
} from 'ng-diagram';

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface AgentMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

@Injectable()
export class CommandProcessorService {
  private readonly diagramService = inject(NgDiagramService);
  private readonly modelService = inject(NgDiagramModelService);
  private readonly nodeService = inject(NgDiagramNodeService);
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly viewportService = inject(NgDiagramViewportService);

  private nodeCounter = 0;
  private edgeCounter = 0;

  processCommand(input: string): CommandResult {
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();

    // Add node commands
    if (
      lower.startsWith('add node') ||
      lower.startsWith('create node') ||
      lower.startsWith('اضف عقدة') ||
      lower.startsWith('انشئ عقدة')
    ) {
      return this.handleAddNode(trimmed);
    }

    // Connect / add edge commands
    if (
      lower.startsWith('connect') ||
      lower.startsWith('link') ||
      lower.startsWith('add edge') ||
      lower.startsWith('وصل') ||
      lower.startsWith('اربط')
    ) {
      return this.handleConnect(trimmed);
    }

    // Delete commands
    if (
      lower.startsWith('delete') ||
      lower.startsWith('remove') ||
      lower.startsWith('احذف') ||
      lower.startsWith('ازل')
    ) {
      return this.handleDelete(trimmed);
    }

    // Search commands
    if (lower.startsWith('search') || lower.startsWith('find') || lower.startsWith('ابحث') || lower.startsWith('جد')) {
      return this.handleSearch(trimmed);
    }

    // Select commands
    if (lower.startsWith('select') || lower.startsWith('اختر') || lower.startsWith('حدد')) {
      return this.handleSelect(trimmed);
    }

    // List commands
    if (lower.startsWith('list') || lower.startsWith('show') || lower.startsWith('اعرض') || lower.startsWith('قائمة')) {
      return this.handleList(lower);
    }

    // Zoom commands
    if (lower.startsWith('zoom') || lower.startsWith('تكبير') || lower.startsWith('تصغير')) {
      return this.handleZoom(lower);
    }

    // Center / fit
    if (lower.startsWith('center') || lower.startsWith('fit') || lower.startsWith('توسيط')) {
      return this.handleCenterFit(lower);
    }

    // Move commands
    if (lower.startsWith('move') || lower.startsWith('انقل') || lower.startsWith('حرك')) {
      return this.handleMove(trimmed);
    }

    // Build workflow
    if (
      lower.startsWith('build workflow') ||
      lower.startsWith('create workflow') ||
      lower.startsWith('بناء سير عمل') ||
      lower.startsWith('انشئ سير عمل')
    ) {
      return this.handleBuildWorkflow(trimmed);
    }

    // Clear
    if (lower === 'clear' || lower === 'clear all' || lower === 'مسح' || lower === 'مسح الكل') {
      return this.handleClearAll();
    }

    // Help
    if (lower === 'help' || lower === 'مساعدة' || lower === '?') {
      return this.getHelp();
    }

    // Info about a node
    if (lower.startsWith('info') || lower.startsWith('معلومات')) {
      return this.handleInfo(trimmed);
    }

    return {
      success: false,
      message: `Unknown command. Type "help" for available commands.\nأمر غير معروف. اكتب "مساعدة" للحصول على الأوامر المتاحة.`,
    };
  }

  private handleAddNode(input: string): CommandResult {
    const label = this.extractQuotedText(input) || `Node ${++this.nodeCounter}`;
    const typeMatch = input.match(/type[:\s]+(\S+)/i);
    const type = typeMatch ? typeMatch[1] : undefined;

    const posMatch = input.match(/(?:at|position|pos)[:\s]+(\d+)[,\s]+(\d+)/i);
    const x = posMatch ? parseInt(posMatch[1], 10) : this.getRandomPosition().x;
    const y = posMatch ? parseInt(posMatch[2], 10) : this.getRandomPosition().y;

    const nodeId = `ai-node-${Date.now()}-${++this.nodeCounter}`;
    const node: Node = {
      id: nodeId,
      position: { x, y },
      data: { label },
      ...(type ? { type } : {}),
    };

    this.modelService.addNodes([node]);

    return {
      success: true,
      message: `✅ Node "${label}" created (id: ${nodeId}) at position (${x}, ${y})`,
      data: node,
    };
  }

  private handleConnect(input: string): CommandResult {
    const ids = this.extractNodeIds(input);

    if (ids.length < 2) {
      // Try by label
      const labels = this.extractMultipleQuotedTexts(input);
      if (labels.length >= 2) {
        const sourceNode = this.findNodeByLabel(labels[0]);
        const targetNode = this.findNodeByLabel(labels[1]);
        if (sourceNode && targetNode) {
          return this.createEdge(sourceNode.id, targetNode.id, labels[2]);
        }
        return {
          success: false,
          message: `❌ Could not find nodes with labels "${labels[0]}" and "${labels[1]}".`,
        };
      }

      return {
        success: false,
        message: '❌ Please specify two node IDs or labels. Example: connect "Node A" to "Node B"',
      };
    }

    return this.createEdge(ids[0], ids[1]);
  }

  private createEdge(sourceId: string, targetId: string, label?: string): CommandResult {
    const source = this.modelService.getNodeById(sourceId);
    const target = this.modelService.getNodeById(targetId);

    if (!source) {
      return { success: false, message: `❌ Source node "${sourceId}" not found.` };
    }
    if (!target) {
      return { success: false, message: `❌ Target node "${targetId}" not found.` };
    }

    const edgeId = `ai-edge-${Date.now()}-${++this.edgeCounter}`;
    const edge: Edge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      data: { label: label || '' },
    };

    this.modelService.addEdges([edge]);

    return {
      success: true,
      message: `✅ Edge created from "${(source.data as { label?: string }).label || source.id}" → "${(target.data as { label?: string }).label || target.id}"`,
      data: edge,
    };
  }

  private handleDelete(input: string): CommandResult {
    const lower = input.toLowerCase();

    if (lower.includes('selected') || lower.includes('selection') || lower.includes('المحدد')) {
      const sel = this.selectionService.selection();
      if (sel.nodes.length === 0 && sel.edges.length === 0) {
        return { success: false, message: '❌ No items selected.' };
      }
      this.selectionService.deleteSelection();
      return {
        success: true,
        message: `✅ Deleted ${sel.nodes.length} node(s) and ${sel.edges.length} edge(s).`,
      };
    }

    const ids = this.extractNodeIds(input);
    if (ids.length > 0) {
      this.modelService.deleteNodes(ids);
      return { success: true, message: `✅ Deleted node(s): ${ids.join(', ')}` };
    }

    const label = this.extractQuotedText(input);
    if (label) {
      const node = this.findNodeByLabel(label);
      if (node) {
        this.modelService.deleteNodes([node.id]);
        return { success: true, message: `✅ Deleted node "${label}"` };
      }
      return { success: false, message: `❌ Node with label "${label}" not found.` };
    }

    return {
      success: false,
      message: '❌ Specify what to delete. Example: delete "Node A" or delete selected',
    };
  }

  private handleSearch(input: string): CommandResult {
    const query = this.extractQuotedText(input) || input.replace(/^(search|find|ابحث|جد)\s*/i, '').trim();

    if (!query) {
      return { success: false, message: '❌ Please specify a search term.' };
    }

    const nodes = this.modelService.nodes();
    const edges = this.modelService.edges();

    const matchingNodes = nodes.filter((n) => {
      const label = ((n.data as { label?: string }).label || '').toLowerCase();
      const id = n.id.toLowerCase();
      const type = (n.type || '').toLowerCase();
      return (
        label.includes(query.toLowerCase()) || id.includes(query.toLowerCase()) || type.includes(query.toLowerCase())
      );
    });

    const matchingEdges = edges.filter((e) => {
      const label = ((e.data as { label?: string }).label || '').toLowerCase();
      const id = e.id.toLowerCase();
      return label.includes(query.toLowerCase()) || id.includes(query.toLowerCase());
    });

    if (matchingNodes.length === 0 && matchingEdges.length === 0) {
      return { success: true, message: `🔍 No results found for "${query}".` };
    }

    const nodeResults = matchingNodes
      .map(
        (n) =>
          `  📦 ${(n.data as { label?: string }).label || n.id} (${n.type || 'default'}) at (${n.position.x}, ${n.position.y})`
      )
      .join('\n');

    const edgeResults = matchingEdges.map((e) => `  🔗 ${e.id}: ${e.source} → ${e.target}`).join('\n');

    // Select found nodes
    if (matchingNodes.length > 0) {
      this.selectionService.select(matchingNodes.map((n) => n.id));
      if (matchingNodes.length === 1) {
        this.viewportService.centerOnNode(matchingNodes[0].id);
      }
    }

    let message = `🔍 Found ${matchingNodes.length} node(s) and ${matchingEdges.length} edge(s):`;
    if (nodeResults) message += `\nNodes:\n${nodeResults}`;
    if (edgeResults) message += `\nEdges:\n${edgeResults}`;

    return { success: true, message, data: { nodes: matchingNodes, edges: matchingEdges } };
  }

  private handleSelect(input: string): CommandResult {
    const lower = input.toLowerCase();

    if (lower.includes('all') || lower.includes('الكل')) {
      const nodes = this.modelService.nodes();
      this.selectionService.select(nodes.map((n) => n.id));
      return { success: true, message: `✅ Selected all ${nodes.length} nodes.` };
    }

    if (lower.includes('none') || lower === 'deselect' || lower.includes('لا شيء')) {
      this.selectionService.deselectAll();
      return { success: true, message: '✅ Deselected all.' };
    }

    const label = this.extractQuotedText(input);
    if (label) {
      const node = this.findNodeByLabel(label);
      if (node) {
        this.selectionService.select([node.id]);
        this.viewportService.centerOnNode(node.id);
        return { success: true, message: `✅ Selected and centered on "${label}"` };
      }
      return { success: false, message: `❌ Node "${label}" not found.` };
    }

    const ids = this.extractNodeIds(input);
    if (ids.length > 0) {
      this.selectionService.select(ids);
      return { success: true, message: `✅ Selected ${ids.length} node(s).` };
    }

    return { success: false, message: '❌ Specify what to select. Example: select "Node A" or select all' };
  }

  private handleList(lower: string): CommandResult {
    if (lower.includes('edge') || lower.includes('connection') || lower.includes('ربط') || lower.includes('حواف')) {
      const edges = this.modelService.edges();
      if (edges.length === 0) {
        return { success: true, message: '📋 No edges in the diagram.' };
      }

      const list = edges.map((e) => `  🔗 ${e.id}: ${e.source} → ${e.target} (${e.type || 'default'})`).join('\n');
      return { success: true, message: `📋 Edges (${edges.length}):\n${list}` };
    }

    const nodes = this.modelService.nodes();
    if (nodes.length === 0) {
      return { success: true, message: '📋 No nodes in the diagram.' };
    }

    const list = nodes
      .map(
        (n) =>
          `  📦 ${(n.data as { label?: string }).label || n.id} [${n.type || 'default'}] at (${Math.round(n.position.x)}, ${Math.round(n.position.y)})`
      )
      .join('\n');
    return { success: true, message: `📋 Nodes (${nodes.length}):\n${list}` };
  }

  private handleZoom(lower: string): CommandResult {
    if (lower.includes('in') || lower.includes('تكبير')) {
      this.viewportService.zoom(1.2);
      return { success: true, message: '🔍 Zoomed in.' };
    }
    if (lower.includes('out') || lower.includes('تصغير')) {
      this.viewportService.zoom(0.8);
      return { success: true, message: '🔍 Zoomed out.' };
    }
    if (lower.includes('fit') || lower.includes('ملائمة')) {
      this.viewportService.zoomToFit();
      return { success: true, message: '🔍 Zoomed to fit.' };
    }

    return { success: false, message: '❌ Use: zoom in, zoom out, or zoom fit' };
  }

  private handleCenterFit(lower: string): CommandResult {
    if (lower.includes('fit')) {
      this.viewportService.zoomToFit();
      return { success: true, message: '🎯 Zoomed to fit all content.' };
    }

    const sel = this.selectionService.selection();
    if (sel.nodes.length > 0) {
      this.viewportService.centerOnNode(sel.nodes[0].id);
      return {
        success: true,
        message: `🎯 Centered on "${(sel.nodes[0].data as { label?: string }).label || sel.nodes[0].id}"`,
      };
    }

    this.viewportService.zoomToFit();
    return { success: true, message: '🎯 Centered and fit to view.' };
  }

  private handleMove(input: string): CommandResult {
    const label = this.extractQuotedText(input);
    const posMatch = input.match(/(?:to|at|position|الى)[:\s]+\(?(\d+)[,\s]+(\d+)\)?/i);

    if (!posMatch) {
      return { success: false, message: '❌ Specify position. Example: move "Node A" to 200, 300' };
    }

    const x = parseInt(posMatch[1], 10);
    const y = parseInt(posMatch[2], 10);

    let node: Node | null = null;
    if (label) {
      node = this.findNodeByLabel(label);
    } else {
      const sel = this.selectionService.selection();
      if (sel.nodes.length > 0) {
        node = sel.nodes[0];
      }
    }

    if (!node) {
      return { success: false, message: '❌ Node not found. Select a node or specify by label.' };
    }

    this.modelService.updateNode(node.id, { position: { x, y } });
    return {
      success: true,
      message: `✅ Moved "${(node.data as { label?: string }).label || node.id}" to (${x}, ${y})`,
    };
  }

  private handleBuildWorkflow(input: string): CommandResult {
    const stepsRaw = input.replace(/^(build workflow|create workflow|بناء سير عمل|انشئ سير عمل)[:\s]*/i, '').trim();
    const steps = stepsRaw
      .split(/[,→>|]/)
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((s) => s.length > 0);

    if (steps.length < 2) {
      return {
        success: false,
        message:
          '❌ Provide at least 2 steps separated by commas or arrows.\nExample: build workflow: Start, Process, Review, Complete',
      };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const startX = 100;
    const startY = 200;
    const spacingX = 250;

    this.diagramService.transaction(() => {
      for (let i = 0; i < steps.length; i++) {
        const nodeId = `wf-node-${Date.now()}-${++this.nodeCounter}`;
        nodes.push({
          id: nodeId,
          position: { x: startX + i * spacingX, y: startY },
          data: { label: steps[i] },
        });
      }

      for (let i = 0; i < nodes.length - 1; i++) {
        const edgeId = `wf-edge-${Date.now()}-${++this.edgeCounter}`;
        edges.push({
          id: edgeId,
          source: nodes[i].id,
          target: nodes[i + 1].id,
          data: {},
        });
      }

      this.modelService.addNodes(nodes);
      this.modelService.addEdges(edges);
    });

    setTimeout(() => this.viewportService.zoomToFit({ padding: 50 }), 100);

    return {
      success: true,
      message: `✅ Workflow created with ${steps.length} steps:\n${steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\nConnected with ${edges.length} edges.`,
      data: { nodes, edges },
    };
  }

  private handleClearAll(): CommandResult {
    const nodes = this.modelService.nodes();
    const edges = this.modelService.edges();

    if (nodes.length === 0 && edges.length === 0) {
      return { success: true, message: '📋 Diagram is already empty.' };
    }

    this.modelService.deleteEdges(edges.map((e) => e.id));
    this.modelService.deleteNodes(nodes.map((n) => n.id));

    return {
      success: true,
      message: `✅ Cleared ${nodes.length} node(s) and ${edges.length} edge(s).`,
    };
  }

  private handleInfo(input: string): CommandResult {
    const label = this.extractQuotedText(input);

    let node: Node | null = null;
    if (label) {
      node = this.findNodeByLabel(label);
    } else {
      const sel = this.selectionService.selection();
      if (sel.nodes.length > 0) {
        node = sel.nodes[0];
      }
    }

    if (!node) {
      return { success: false, message: '❌ Node not found. Select a node or specify by label.' };
    }

    const connectedEdges = this.modelService.getConnectedEdges(node.id);
    const connectedNodes = this.modelService.getConnectedNodes(node.id);

    const info = [
      `📦 Node Info:`,
      `  ID: ${node.id}`,
      `  Label: ${(node.data as { label?: string }).label || 'N/A'}`,
      `  Type: ${node.type || 'default'}`,
      `  Position: (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`,
      `  Size: ${node.size ? `${node.size.width}x${node.size.height}` : 'auto'}`,
      `  Rotation: ${node.angle || 0}°`,
      `  Connected Edges: ${connectedEdges.length}`,
      `  Connected Nodes: ${connectedNodes.map((n) => (n.data as { label?: string }).label || n.id).join(', ') || 'none'}`,
    ];

    return { success: true, message: info.join('\n'), data: node };
  }

  private getHelp(): CommandResult {
    const commands = [
      '📖 Available Commands / الأوامر المتاحة:',
      '',
      '🔨 Create:',
      '  add node "Label" [type:chip] [at 100,200]',
      '  اضف عقدة "التسمية"',
      '',
      '🔗 Connect:',
      '  connect "Node A" to "Node B"',
      '  وصل "عقدة أ" الى "عقدة ب"',
      '',
      '🗑️ Delete:',
      '  delete "Node A" | delete selected',
      '  احذف "عقدة أ" | احذف المحدد',
      '',
      '🔍 Search:',
      '  search "keyword" | find "text"',
      '  ابحث "كلمة"',
      '',
      '📋 List:',
      '  list nodes | list edges',
      '  اعرض العقد | اعرض الحواف',
      '',
      '🎯 Select:',
      '  select "Node A" | select all | deselect',
      '  اختر "عقدة" | اختر الكل',
      '',
      '🔍 Zoom:',
      '  zoom in | zoom out | zoom fit',
      '',
      '📍 Move:',
      '  move "Node A" to 200, 300',
      '  انقل "عقدة" الى 200, 300',
      '',
      '📊 Workflow:',
      '  build workflow: Start, Process, Review, End',
      '  بناء سير عمل: بداية, معالجة, مراجعة, نهاية',
      '',
      '🧹 Clear:',
      '  clear all',
      '  مسح الكل',
      '',
      'ℹ️ Info:',
      '  info "Node A" | info (selected)',
      '  معلومات "عقدة"',
    ];

    return { success: true, message: commands.join('\n') };
  }

  private findNodeByLabel(label: string): Node | null {
    return (
      this.modelService.nodes().find((n) => {
        const nodeLabel = (n.data as { label?: string }).label || '';
        return nodeLabel.toLowerCase() === label.toLowerCase();
      }) ?? null
    );
  }

  private extractQuotedText(input: string): string | null {
    const match = input.match(/["'""]([^"'"]+)["'""]/);
    return match ? match[1] : null;
  }

  private extractMultipleQuotedTexts(input: string): string[] {
    const matches = input.matchAll(/["'""]([^"'"]+)["'""]/g);
    return Array.from(matches, (m) => m[1]);
  }

  private extractNodeIds(input: string): string[] {
    const matches = input.matchAll(/\b([\w-]+-node-[\w-]+)\b/g);
    return Array.from(matches, (m) => m[1]);
  }

  private getRandomPosition(): { x: number; y: number } {
    const nodes = this.modelService.nodes();
    if (nodes.length === 0) {
      return { x: 200, y: 200 };
    }

    const maxX = Math.max(...nodes.map((n) => n.position.x)) + 200;
    const avgY = nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length;

    return { x: maxX, y: avgY };
  }
}
