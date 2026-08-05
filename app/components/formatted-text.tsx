import { Fragment, type ReactNode } from "react";

const tokenPattern = /(\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([^*]+?)\*)/g;

function formatTaggedText(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  const openingPattern = /\[(b|i|u|s)\]/g;
  for (;;) {
    openingPattern.lastIndex = cursor;
    const match = openingPattern.exec(value);
    if (!match) break;
    const tag = match[1];
    const closing = `[/${tag}]`;
    const closeIndex = value.indexOf(closing, openingPattern.lastIndex);
    if (closeIndex < 0) break;
    if (match.index > cursor) nodes.push(...formatLegacyText(value.slice(cursor, match.index)));
    const children = formatTaggedText(value.slice(openingPattern.lastIndex, closeIndex));
    if (tag === "b") nodes.push(<strong key={`${match.index}-b`}>{children}</strong>);
    if (tag === "i") nodes.push(<em key={`${match.index}-i`}>{children}</em>);
    if (tag === "u") nodes.push(<u key={`${match.index}-u`}>{children}</u>);
    if (tag === "s") nodes.push(<s key={`${match.index}-s`}>{children}</s>);
    cursor = closeIndex + closing.length;
  }
  if (cursor < value.length) nodes.push(...formatLegacyText(value.slice(cursor)));
  return nodes;
}

function formatLegacyText(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(value.slice(cursor, index));
    const content = match[2] ?? match[3] ?? match[4] ?? match[5] ?? "";
    const children = formatTaggedText(content);
    if (match[2] !== undefined) nodes.push(<strong key={`${index}-b`}>{children}</strong>);
    else if (match[3] !== undefined) nodes.push(<u key={`${index}-u`}>{children}</u>);
    else if (match[4] !== undefined) nodes.push(<s key={`${index}-s`}>{children}</s>);
    else nodes.push(<em key={`${index}-i`}>{children}</em>);
    cursor = index + match[0].length;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}

export function formatInlineText(value: string): ReactNode[] {
  return formatTaggedText(value);
}
