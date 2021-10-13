export function toDataURL(inputStr)
{
    const base64Str = `data:text/javascript;base64,${Buffer.from(inputStr).toString('base64')}`;
    return base64Str;
}
