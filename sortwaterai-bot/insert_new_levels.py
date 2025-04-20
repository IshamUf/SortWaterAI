import psycopg2, json, os
from datetime import datetime
from dotenv import load_dotenv

# --- конфиг ---------------------------------------------------------------
load_dotenv()

def get_db_config():
    return {
        "dbname":   os.getenv("POSTGRES_DB"),
        "user":     os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "host":     "localhost",
        "port":     int(os.getenv("POSTGRES_PORT", 5432)),
    }

# --- вставка уровней -------------------------------------------------------
def insert_levels(level_items, db_cfg):
    """
    level_items = [
        ({"state": [...]}, "easy",  None),
        ({"state": [...]}, "medium", 12),
        ...
    ]
    """
    conn   = psycopg2.connect(**db_cfg)
    cursor = conn.cursor()
    now    = datetime.utcnow()

    for level_json, difficulty, ai_steps in level_items:
        cursor.execute(
            """
            INSERT INTO "Levels" (level_data, difficulty, ai_steps,
                                  "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                json.dumps(level_json),          # level_data
                str(difficulty) if difficulty is not None else None,
                ai_steps,
                now, now,
            ),
        )

    conn.commit()
    cursor.close(); conn.close()
    print(f"✅  Inserted {len(level_items)} level(s)")

# --------------------------------------------------------------------------
if __name__ == "__main__":
    example_data = [
        ({"state": [[4,5,4,5],[5,4,5,4],[6,6,6,6],[-1,-1,-1,-1],[-1,-1,-1,-1]]},
         "medium", None),
        ({"state": [[0,1,2,3],[3,0,2,1],[1,2,3,0],[0,1,2,3],[-1,-1,-1,-1],[-1,-1,-1,-1]]},
         "hard", 14),
        ({"state": [[4,5,6,7],[7,6,5,4],[4,5,6,7],[7,6,5,4],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]]},
         "expert", 32),
    ]

    db_cfg = get_db_config()
    insert_levels(example_data, db_cfg)
