export const logService = (action: string, args: any, result: any, tag: string, description: string) => {
  console.info(`
\x1b[36mSERVICE\x1b[0m   \x1b[33m${action}\x1b[0m [\x1b[35m${tag}\x1b[0m] - \x1b[90m${description}\x1b[0m
\x1b[32m ARGS \x1b[0m
${JSON.stringify(args, null, 2)}
\x1b[32m RESULT SUCCESS \x1b[0m
${JSON.stringify(result, null, 2)}
`);
};
