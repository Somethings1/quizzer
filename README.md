Quizz maker app
---

# Installation
## Prequisites
NodeJS and NPM.

## First time installation
```zsh
git clone https://github.com/Somethings1/quizzer.git
cd quizzer
npm install --legacy-peer-deps
npm run dev
```

## Manual update
Go to quizzer folder
```zsh
git pull
npm install --legacy-peer-deps
npm run dev
```

# Instruction
## Keyboard navigation
### Common keyboard shortcuts
These shortcuts are used in both testing mode and reviewing mode
- `LeftArrow` or `h` to go to previous question
- `RightArrow` or `l` to go to next question
- `UpArrow` or `Space` to enter jumping mode, then quickly press numbers to go
to a specific question. For example `Space+1+2` go to question 12.

### Testing mode
These shortcuts are available only in testing mode
- Searching:
    - Use `/` or normal `cmd+F` and `ctrl+F` to search in a running test.
    - Use `Enter`, `n` or `DownArrow` to navigate to next search result.
    - Use `N` or `UpArrow` to navigate to previous search result.

- Press ` (backtick) to mark current question for review.
