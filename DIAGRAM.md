# BudgetBuddy Diagrams

## App Flow

```text
+------------------+
| User opens app   |
+--------+---------+
         |
         v
+------------------+
| Login / Signup   |
+--------+---------+
         |
         v
+-----------------------------+
| /income                     |
| - set monthly income        |
| - show latest global advice |
+--------+--------------------+
         |
         v
+------------------+
| Upload statement |
| /upload          |
+--------+---------+
         |
         v
+---------------------------+
| POST /api/analysis/upload |
| create pending analysis   |
+--------+------------------+
         |
         v
+---------------------------+
| Async analysis job        |
| processFileAsync()        |
+--------+------------------+
         |
         v
+------------------------------+
| /results/:id                 |
| - categorized expenses       |
| - recommendations            |
| - history                    |
| - debt plan                  |
+--------+---------------------+
         |
         +--------------------+
         |                    |
         v                    v
+------------------+  +------------------+
| /history         |  | /debt            |
| previous reports |  | debt planning    |
+------------------+  +------------------+
```

## Analysis Logic Flow

```text
+------------------------------------------------------+
| processFileAsync(userId, analysisId, filePath, income) |
+---------------------------+--------------------------+
                            |
                            v
                  +----------------------+
                  | fileProcessor        |
                  | extract text content |
                  +----------+-----------+
                             |
                             v
                 +-------------------------+
                 | aiService.analyzeExpenses |
                 +------------+------------+
                              |
          +-------------------+-------------------+
          |                                       |
          v                                       v
+--------------------------+         +--------------------------+
| CATEGORIZER_AGENT        |         | ADVISOR_AGENT            |
| calls CATEGORIZER_TOOL   |         | calls ADVISOR_TOOL       |
| -> AI categorizes lines  |         | -> AI writes advice      |
| -> fallback rules        |         | -> fallback rules        |
+-------------+------------+         +-------------+------------+
              |                                        |
              +-------------------+--------------------+
                                  |
                                  v
                    +-------------------------------+
                    | Calculate totals from expenses |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | GLOBAL_ADVISOR_AGENT          |
                    | runs only for new analysis    |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | Build current analysis summary |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | Vector Store Service          |
                    | - embed summary               |
                    | - upsert analysis_embeddings  |
                    | - retrieve similar analyses   |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | GLOBAL_ADVISOR_TOOL           |
                    | - current summary             |
                    | - recent analyses             |
                    | - RAG similar analyses        |
                    | -> AI returns 3-line advice   |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | Persist global_advice_snapshot |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | Update budget_analyses row    |
                    | status=completed              |
                    | expenses + recommendations    |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | GET /api/global-advice/latest |
                    | shown on /income              |
                    +-------------------------------+
```

## Data Stores

```text
+--------------------------+
| budget_analyses          |
| - raw analysis result    |
| - totals                 |
| - recommendations        |
| - status                 |
+--------------------------+

+--------------------------+
| analysis_embeddings      |
| - one vector per analysis|
| - summary text           |
| - embedding array JSON   |
+--------------------------+

+--------------------------+
| global_advice_snapshots  |
| - advice text            |
| - progress status        |
| - supporting analysis ids|
+--------------------------+
```
