/**
 * 企业微信格式化器
 * 将 IMMessage 转换为企业微信机器人消息格式
 */

import type { GatewayEvent, TargetEndpoint, FormattedRequest, IMMessage, OutputFormatter } from '../core/types';
import { PROVIDER_BASE_URLS, HEADERS } from '../core/constants';

export class WechatWorkFormatter implements OutputFormatter {
  readonly name = 'wechatwork';
  readonly provider = 'wechatwork' as const;

  format(event: GatewayEvent, target: TargetEndpoint): FormattedRequest {
    const { message } = event;
    const body = this.buildMessage(message);

    return {
      url: this.buildUrl(target),
      method: 'POST',
      headers: { [HEADERS.CONTENT_TYPE]: HEADERS.CONTENT_TYPE_JSON },
      body,
    };
  }

  private buildUrl(target: TargetEndpoint): string {
    return `${PROVIDER_BASE_URLS.wechatwork}${target.token}`;
  }

  private buildMessage(message: IMMessage): Record<string, unknown> {

    //走text
    return this.buildWalineMessage(message);
    
    
    // 如果有链接或图片，使用图文消息
    if (message.link && message.images?.some((img) => img.type === 'cover')) {
      return this.buildNewsMessage(message);
    }

    // 默认使用 Markdown
    return this.buildMarkdown(message);
  }

  private buildMarkdown(message: IMMessage): Record<string, unknown> {
    const parts: string[] = [];

    // 标题 (使用绿色高亮)
    if (message.title) {
      parts.push(`### ${message.title}`);
    }

    // 正文
    if (message.body) {
      parts.push(message.body);
    }

    // 字段
    if (message.fields && message.fields.length > 0) {
      parts.push('');
      for (const field of message.fields) {
        parts.push(`> **${field.label}**: <font color="comment">${field.value}</font>`);
      }
    }

    // 链接
    if (message.link) {
      parts.push('');
      parts.push(`[查看详情](${message.link})`);
    }

    // 页脚
    if (message.footer) {
      parts.push('');
      parts.push(`<font color="comment">${message.footer}</font>`);
    }

    const result: Record<string, unknown> = {
      msgtype: 'markdown',
      markdown: {
        content: parts.join('\n'),
      },
    };

    // @提及
    if (message.mentions && message.mentions.length > 0) {
      const mentioned_list: string[] = [];
      const mentioned_mobile_list: string[] = [];

      for (const mention of message.mentions) {
        if (mention.type === 'all') {
          mentioned_list.push('@all');
        } else if (mention.userId) {
          mentioned_list.push(mention.userId);
        } else if (mention.name) {
          mentioned_mobile_list.push(mention.name);
        }
      }

      // 在内容末尾添加 @
      if (mentioned_list.length > 0 || mentioned_mobile_list.length > 0) {
        const mentions: string[] = [];
        for (const m of mentioned_list) {
          mentions.push(`<@${m}>`);
        }
        result.markdown = {
          content: parts.join('\n') + '\n' + mentions.join(' '),
          mentioned_list,
          mentioned_mobile_list,
        };
      }
    }

    return result;
  }

  private buildNewsMessage(message: IMMessage): Record<string, unknown> {
    const coverImage = message.images?.find((img) => img.type === 'cover');

    return {
      msgtype: 'news',
      news: {
        articles: [
          {
            title: message.title || '通知',
            description: message.body,
            url: message.link,
            picurl: coverImage?.url,
          },
        ],
      },
    };
  }
  private buildWalineMessage(message: IMMessage): Record<string, unknown> {
    // 从 message 中提取 comment 数据
    // 假设 message.body 包含原始 JSON 字符串或已解析的对象
    let data: any;
    
    try {
      // 尝试解析 body 为 JSON
      data = typeof message.body === 'string' ? JSON.parse(message.body) : message.body;
    } catch {
      // 解析失败则直接使用 body
      data = { data: { comment: {} } };
    }

    const comment = data?.data?.comment || {};

    const lines: string[] = [
      `${comment.nick || '游客'}评论道:`,
      comment.comment || '',
      `邮箱: ${comment.mail || ''}`,
      `状态: ${comment.status || ''}`,
      `时间：${comment.insertedAt || ''}`,
      `IP：${comment.ip || ''}`,
      `仅供评论预览，查看完整內容:`,
      `https://www.huochairener-blog.cn${comment.url || ''}`
    ];

    return {
      msgtype: 'text',
      text: {
        content: lines.join('\n'),
      },
    };
  }
}
