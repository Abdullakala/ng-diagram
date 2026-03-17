import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgDiagramModelService, NgDiagramSelectionService } from 'ng-diagram';
import { AgentMessage, CommandProcessorService } from './command-processor.service';

@Component({
  selector: 'app-ai-agent-panel',
  templateUrl: './ai-agent-panel.component.html',
  styleUrl: './ai-agent-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe],
  providers: [CommandProcessorService],
})
export class AiAgentPanelComponent {
  private readonly commandProcessor = inject(CommandProcessorService);
  private readonly modelService = inject(NgDiagramModelService);
  private readonly selectionService = inject(NgDiagramSelectionService);

  private readonly messagesContainer = viewChild<ElementRef<HTMLElement>>('messagesContainer');

  isOpen = signal(true);
  inputText = signal('');
  messages = signal<AgentMessage[]>([
    {
      role: 'agent',
      content:
        '🤖 Welcome to the AI Development Agent!\nمرحباً بك في وكيل التطوير الذكي!\n\nI can help you build workflows, create nodes, connect elements, search, and manage your diagram.\nType "help" or "مساعدة" for available commands.',
      timestamp: new Date(),
    },
  ]);

  nodeCount = computed(() => this.modelService.nodes().length);
  edgeCount = computed(() => this.modelService.edges().length);
  selectedCount = computed(() => {
    const sel = this.selectionService.selection();
    return sel.nodes.length + sel.edges.length;
  });

  suggestions = signal<string[]>([
    'build workflow: Start, Process, Review, End',
    'add node "My Node"',
    'list nodes',
    'search "Node"',
    'help',
  ]);

  constructor() {
    effect(() => {
      this.messages();
      setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  togglePanel(): void {
    this.isOpen.update((v) => !v);
  }

  onSubmit(): void {
    const text = this.inputText().trim();
    if (!text) return;

    this.addMessage('user', text);
    this.inputText.set('');

    setTimeout(() => {
      const result = this.commandProcessor.processCommand(text);
      this.addMessage('agent', result.message);
    }, 150);
  }

  onSuggestionClick(suggestion: string): void {
    this.inputText.set(suggestion);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSubmit();
    }
  }

  clearHistory(): void {
    this.messages.set([
      {
        role: 'agent',
        content: '🧹 Chat history cleared.\nType "help" for available commands.',
        timestamp: new Date(),
      },
    ]);
  }

  private addMessage(role: 'user' | 'agent', content: string): void {
    this.messages.update((msgs) => [...msgs, { role, content, timestamp: new Date() }]);
  }

  private scrollToBottom(): void {
    const container = this.messagesContainer()?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}
