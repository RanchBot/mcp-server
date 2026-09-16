// Generated from api/src/lib/birthBundle.ts.
// Regenerate: cd api && npx ts-node scripts/gen-birth-schema.ts
export const birthBundleInputSchema = {
  "type": "object",
  "properties": {
    "dam_id": {
      "type": "string",
      "format": "uuid"
    },
    "birth_date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "time_precision": {
      "type": "string",
      "enum": [
        "date_only",
        "morning",
        "afternoon",
        "evening",
        "night"
      ],
      "default": "date_only"
    },
    "dam_update": {
      "type": "object",
      "properties": {
        "kind": {
          "type": "string",
          "minLength": 1,
          "maxLength": 80
        },
        "notes": {
          "type": "string",
          "minLength": 1,
          "maxLength": 1000
        }
      },
      "additionalProperties": false
    },
    "maternal_observations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          }
        },
        "required": [
          "date",
          "text"
        ],
        "additionalProperties": false
      },
      "maxItems": 20,
      "default": []
    },
    "lactation_observations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          }
        },
        "required": [
          "date",
          "text"
        ],
        "additionalProperties": false
      },
      "maxItems": 20,
      "default": []
    },
    "offspring": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "review_label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80,
            "description": "Temporary review label only; never an invented identifier."
          },
          "sex": {
            "type": "string",
            "enum": [
              "male",
              "female",
              "unknown"
            ]
          },
          "birth_weight": {
            "type": "object",
            "properties": {
              "value": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 1000
              },
              "unit": {
                "type": "string",
                "enum": [
                  "kg",
                  "lb"
                ]
              }
            },
            "required": [
              "value",
              "unit"
            ],
            "additionalProperties": false
          },
          "vigor": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "date": {
                  "type": "string",
                  "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
                },
                "text": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1000
                }
              },
              "required": [
                "date",
                "text"
              ],
              "additionalProperties": false
            },
            "maxItems": 20,
            "default": []
          },
          "supplementation": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "date": {
                  "type": "string",
                  "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
                },
                "substance": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 80
                },
                "amount": {
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 100000
                },
                "unit": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 80
                },
                "source": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1000,
                  "description": "Producer-stated source, e.g. own dam. Never prescribe care."
                }
              },
              "required": [
                "date",
                "substance",
                "amount",
                "unit",
                "source"
              ],
              "additionalProperties": false
            },
            "maxItems": 20,
            "default": []
          }
        },
        "required": [
          "review_label",
          "sex"
        ],
        "additionalProperties": false
      },
      "minItems": 1,
      "maxItems": 20
    },
    "sire": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "unknown",
            "presumed",
            "confirmed"
          ]
        },
        "animal_id": {
          "type": "string",
          "format": "uuid"
        },
        "provenance": {
          "type": "string",
          "minLength": 1,
          "maxLength": 1000
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      },
      "required": [
        "status"
      ],
      "additionalProperties": false,
      "default": {
        "status": "unknown"
      }
    },
    "protocol": {
      "type": "object",
      "properties": {
        "claimed_name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 80
        },
        "completed_date": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "version_id": {
          "type": "string",
          "format": "uuid"
        },
        "offspring_labels": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80
          },
          "minItems": 1,
          "maxItems": 20
        }
      },
      "required": [
        "claimed_name",
        "completed_date",
        "offspring_labels"
      ],
      "additionalProperties": false
    },
    "follow_up": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          },
          "due_date": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "offspring_labels": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 80
            },
            "minItems": 1,
            "maxItems": 20
          }
        },
        "required": [
          "name",
          "offspring_labels"
        ],
        "additionalProperties": false
      },
      "maxItems": 20,
      "default": []
    },
    "group_ids": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uuid"
      },
      "maxItems": 20,
      "default": [],
      "description": "Explicitly reviewed current group memberships. Does not record movement."
    },
    "current_location": {
      "type": "string",
      "minLength": 1,
      "maxLength": 80,
      "description": "Explicitly reviewed current location only; does not create movement history."
    },
    "source_sms_id": {
      "type": "string",
      "format": "uuid"
    },
    "additional_source_sms_ids": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uuid"
      },
      "maxItems": 20,
      "default": []
    },
    "source_message_id": {
      "type": "string",
      "format": "uuid"
    },
    "evidence": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file_id": {
            "type": "string",
            "format": "uuid"
          },
          "media_id": {
            "type": "string",
            "format": "uuid"
          },
          "link_to_dam": {
            "type": "boolean",
            "default": false
          },
          "offspring_label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80
          }
        },
        "required": [
          "file_id"
        ],
        "additionalProperties": false
      },
      "maxItems": 20,
      "default": []
    },
    "unresolved": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "maxItems": 30,
      "default": []
    }
  },
  "required": [
    "dam_id",
    "birth_date",
    "offspring"
  ],
  "additionalProperties": false
};
