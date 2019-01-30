# ibatis-to-mybatis-converter

I want convert several `ibatis` XML mapper to `mybatis` mapper, to migrate my project from `ibatis` to `mybatis`.

Since I can't find a usable conversion tool, I created one.
This time I tried to use `TypeScript` to implement my function.

-------------

For now, this tool basically working,
but I don't want to publish this tool because the tool have too many 'low' things in it.

Someday I should refactor this project, make it prettier and stronger, if I remember.

'Low' things such as:
- The `MyBatis` mapper output format is ugly
- The comments in `ibatis` source file was ignored
- The code has a bad structure and bad implementation
- No unit tests

## USAGE
To use this tool, you should manually install it first:
0. Ensure you have `Node JS` and `npm` installed
1. Clone this repository to a 'stable' path
2. `cd` to cloned directory, run `npm install && npm install -g`

'stable' path means you should not move or rename it.

Simple usage:
```
ibatis-to-mybatis-converter /path/to/source/dir /path/to/new/mybatis/dir
```
