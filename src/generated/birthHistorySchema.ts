// Generated from api/src/lib/birthHistory.ts.
// Regenerate: cd api && npm run gen:birth-schema
export const birthHistorySettingsJsonSchema = {
  "type": "object",
  "properties": {
    "version": {
      "type": "number",
      "const": 1
    },
    "species": {
      "type": "string",
      "enum": [
        "BISON",
        "CATTLE",
        "ELK",
        "GOAT",
        "HORSE",
        "OTHER",
        "SHEEP"
      ]
    },
    "gestation_days": {
      "type": "object",
      "properties": {
        "min": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2000
        },
        "max": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2000
        }
      },
      "required": [
        "min",
        "max"
      ],
      "additionalProperties": false
    },
    "minimum_sire_age_days": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10000
    },
    "birth_windows": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80
          },
          "start_date": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end_date": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "label",
          "start_date",
          "end_date"
        ],
        "additionalProperties": false
      },
      "maxItems": 40,
      "default": []
    }
  },
  "required": [
    "version",
    "species"
  ],
  "additionalProperties": false
};
