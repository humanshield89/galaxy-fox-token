# Audit Fixes

## ISSUE 1 (page 8)

resolved => commit => 3ff46c16df0605d097ed006fa9ed584398f1659c

## Issue 2 (page 9)

resolved => commit => 77afcebf684dcfc39c0e7d90c9eefc5bad1a8f05

## Issue 3 (page 10)
 
resolved => commit => f35b98a305ff0ee635e40db550bfaa756cd85bd1

**Details:**
  
There are only few ways to make the main pair changeable without introducing the possibility of honeypot, we implemented a no revert if the swap/liquidity fail we think this is enough to address the issue.

## Issue 4 (page 12)

resolved => 2f082e57623fbd6565fbf4786bc631bd7b411c1c

## Issue 5 (page 13)

resolved => 6effce257e312cb08d362068cec9ce7ec7787cf8

## Issue 6 (page 14)

resolved => c465c73160d9f81f448236ec83bd0888223dfec4

## Issue 7 (page 15)

resolved => a4175cbe7c61a46bd47d835cd288e2c0fb8fecf6

## Issue 8: (page 16)

Details : mentioned variables have to start with an underscore to avoid shadowing global state, which is a very common standards for function arguments.

* All the keys mentioned were respected in the code and we suggest removing this from the report as they do not reflect the state of the code.

```text
// quoting from report 
2. Use PascalCase for contract, struct, and enum names, with the first letter in
uppercase (e.g., MyContract, UserStruct, ErrorEnum).
3. Use uppercase for constant variables and enums (e.g., MAX_VALUE,
ERROR_CODE).
4. Use indentation to improve readability and structure.
5. Use spaces between operators and after commas.
6. Use comments to explain the purpose and behavior of the code.
7. Keep lines short (around 120 characters) to improve readability.
```

## Issue 8 (page 18)

Already covered in MEE page 9 issue 2 (same issue related to missing events maybe more apropiate to be in MEE)

## Issue 9 (page 19) 

resolved => 74b05bad55c7576d32c7306df0ee4e22203232c3

## Issue 10 (page 20)

resolved => ee718d62704af83dcecef7e054104b5a03290915

## Issue 11 (page 21)
resolved => 738eea805808872f4e34c42e84bf32b18f85f816