// AUTO-GENERATED por scripts/issue-273-monte-carlo/run-per-template.mjs
// NÃO EDITAR À MÃO. Regenerar com:
//   node scripts/issue-273-monte-carlo/run-per-template.mjs
//
// Modelo: stop-on-win com recovery após loss · RR 1:2 · 100k iter · WR 0.45/0.50/0.55
// Base por template: { DD: drawdown.maxAmount, TARGET: profitTarget, DAYS: evalTimeLimit × 5/7 }
//
// Limitações conhecidas:
//  - dailyLossLimit não modelado (FAIL_ACCOUNT/PAUSE_DAY ignorado)
//  - Trailing drawdown aproximado como STATIC
//  - RNG Math.random() — variação ±0.5pp entre runs

export const PROP_FIRM_MC_STATS = {
  "apex-eod-25k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 1000,
    "TARGET": 1500,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 43,
          "bust": 2.4,
          "days": 15.4
        },
        "wr50": {
          "pass": 64,
          "bust": 0.7,
          "days": 14.8
        },
        "wr55": {
          "pass": 82,
          "bust": 0.2,
          "days": 13.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 69,
          "bust": 7.9,
          "days": 12.1
        },
        "wr50": {
          "pass": 85,
          "bust": 3.1,
          "days": 11.2
        },
        "wr55": {
          "pass": 94,
          "bust": 1.3,
          "days": 10.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 75,
          "bust": 16.6,
          "days": 10
        },
        "wr50": {
          "pass": 87,
          "bust": 8.7,
          "days": 9.2
        },
        "wr55": {
          "pass": 94,
          "bust": 4.2,
          "days": 8.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 69,
          "bust": 21.5,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.4,
          "days": 8.8
        },
        "wr55": {
          "pass": 90,
          "bust": 7.6,
          "days": 8.1
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 72,
          "bust": 21.2,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13.1,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.8,
          "days": 6.9
        }
      }
    }
  },
  "apex-eod-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 2500,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 59,
          "bust": 2.5,
          "days": 13.6
        },
        "wr50": {
          "pass": 79,
          "bust": 0.7,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 0.2,
          "days": 11.8
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 78,
          "bust": 8,
          "days": 10.3
        },
        "wr50": {
          "pass": 91,
          "bust": 3.4,
          "days": 9.4
        },
        "wr55": {
          "pass": 97,
          "bust": 1.2,
          "days": 8.4
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 80,
          "bust": 16.1,
          "days": 7.8
        },
        "wr50": {
          "pass": 90,
          "bust": 8.5,
          "days": 7
        },
        "wr55": {
          "pass": 95,
          "bust": 4.3,
          "days": 6.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 72,
          "bust": 21.3,
          "days": 8.1
        },
        "wr50": {
          "pass": 83,
          "bust": 13.3,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.8,
          "days": 6.9
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 77,
          "bust": 20.2,
          "days": 6.5
        },
        "wr50": {
          "pass": 85,
          "bust": 12.8,
          "days": 6
        },
        "wr55": {
          "pass": 92,
          "bust": 7.4,
          "days": 5.4
        }
      }
    }
  },
  "apex-eod-100k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 3000,
    "TARGET": 6000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 19,
          "bust": 2.4,
          "days": 17.5
        },
        "wr50": {
          "pass": 36,
          "bust": 0.8,
          "days": 17.1
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 8.1,
          "days": 14.8
        },
        "wr50": {
          "pass": 69,
          "bust": 3.2,
          "days": 14.1
        },
        "wr55": {
          "pass": 86,
          "bust": 1.2,
          "days": 13.2
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 67,
          "bust": 16.6,
          "days": 11.9
        },
        "wr50": {
          "pass": 83,
          "bust": 8.6,
          "days": 11.1
        },
        "wr55": {
          "pass": 92,
          "bust": 4.2,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 57,
          "bust": 21.6,
          "days": 11.6
        },
        "wr50": {
          "pass": 72,
          "bust": 13.2,
          "days": 11
        },
        "wr55": {
          "pass": 84,
          "bust": 7.9,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.7,
          "days": 10.5
        },
        "wr50": {
          "pass": 76,
          "bust": 13.4,
          "days": 9.9
        },
        "wr55": {
          "pass": 86,
          "bust": 7.6,
          "days": 9.2
        }
      }
    }
  },
  "apex-eod-150k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 5000,
    "TARGET": 9000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 27,
          "bust": 2.4,
          "days": 16.8
        },
        "wr50": {
          "pass": 48,
          "bust": 0.7,
          "days": 16.3
        },
        "wr55": {
          "pass": 69,
          "bust": 0.2,
          "days": 15.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 59,
          "bust": 7.9,
          "days": 13.6
        },
        "wr50": {
          "pass": 78,
          "bust": 3.3,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 1.2,
          "days": 11.8
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 71,
          "bust": 16.7,
          "days": 11.1
        },
        "wr50": {
          "pass": 85,
          "bust": 8.6,
          "days": 10.1
        },
        "wr55": {
          "pass": 93,
          "bust": 4.2,
          "days": 9.1
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 56,
          "bust": 21.7,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.3,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 7.7,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 68,
          "bust": 21.6,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.2,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.7,
          "days": 8
        }
      }
    }
  },
  "apex-eod-250k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 6500,
    "TARGET": 15000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 7,
          "bust": 2.4,
          "days": 18.6
        },
        "wr50": {
          "pass": 17,
          "bust": 0.7,
          "days": 18.4
        },
        "wr55": {
          "pass": 35,
          "bust": 0.2,
          "days": 18.1
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 37,
          "bust": 8,
          "days": 15.9
        },
        "wr50": {
          "pass": 58,
          "bust": 3.3,
          "days": 15.3
        },
        "wr55": {
          "pass": 78,
          "bust": 1.2,
          "days": 14.5
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 57,
          "bust": 16.8,
          "days": 13.5
        },
        "wr50": {
          "pass": 76,
          "bust": 8.9,
          "days": 12.6
        },
        "wr55": {
          "pass": 89,
          "bust": 4.4,
          "days": 11.7
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 44,
          "bust": 21.7,
          "days": 13.2
        },
        "wr50": {
          "pass": 61,
          "bust": 13.2,
          "days": 12.7
        },
        "wr55": {
          "pass": 76,
          "bust": 7.8,
          "days": 12
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 57,
          "bust": 21.5,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.4,
          "days": 11
        },
        "wr55": {
          "pass": 84,
          "bust": 7.8,
          "days": 10.2
        }
      }
    }
  },
  "apex-eod-300k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 7500,
    "TARGET": 20000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 3,
          "bust": 2.5,
          "days": 19.3
        },
        "wr50": {
          "pass": 8,
          "bust": 0.7,
          "days": 19.1
        },
        "wr55": {
          "pass": 19,
          "bust": 0.2,
          "days": 18.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 27,
          "bust": 8.2,
          "days": 16.8
        },
        "wr50": {
          "pass": 48,
          "bust": 3.2,
          "days": 16.3
        },
        "wr55": {
          "pass": 69,
          "bust": 1.2,
          "days": 15.6
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 47,
          "bust": 16.8,
          "days": 14.8
        },
        "wr50": {
          "pass": 68,
          "bust": 8.7,
          "days": 14
        },
        "wr55": {
          "pass": 84,
          "bust": 4.4,
          "days": 13.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 39,
          "bust": 21.7,
          "days": 14
        },
        "wr50": {
          "pass": 56,
          "bust": 13.2,
          "days": 13.5
        },
        "wr55": {
          "pass": 72,
          "bust": 7.8,
          "days": 12.9
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 52,
          "bust": 21.8,
          "days": 12.8
        },
        "wr50": {
          "pass": 69,
          "bust": 13.4,
          "days": 12.1
        },
        "wr55": {
          "pass": 82,
          "bust": 7.8,
          "days": 11.4
        }
      }
    }
  },
  "apex-intraday-25k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 1000,
    "TARGET": 1500,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 43,
          "bust": 2.4,
          "days": 15.3
        },
        "wr50": {
          "pass": 64,
          "bust": 0.7,
          "days": 14.8
        },
        "wr55": {
          "pass": 82,
          "bust": 0.2,
          "days": 13.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 69,
          "bust": 8.1,
          "days": 12.1
        },
        "wr50": {
          "pass": 85,
          "bust": 3.2,
          "days": 11.2
        },
        "wr55": {
          "pass": 94,
          "bust": 1.2,
          "days": 10.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 74,
          "bust": 16.8,
          "days": 10
        },
        "wr50": {
          "pass": 87,
          "bust": 8.7,
          "days": 9.1
        },
        "wr55": {
          "pass": 94,
          "bust": 4.3,
          "days": 8.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 68,
          "bust": 21.5,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.3,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.8,
          "days": 8.1
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 73,
          "bust": 21,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13.1,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.7,
          "days": 6.9
        }
      }
    }
  },
  "apex-intraday-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 2500,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 60,
          "bust": 2.5,
          "days": 13.6
        },
        "wr50": {
          "pass": 79,
          "bust": 0.7,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 0.2,
          "days": 11.8
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 78,
          "bust": 8.1,
          "days": 10.4
        },
        "wr50": {
          "pass": 91,
          "bust": 3.2,
          "days": 9.4
        },
        "wr55": {
          "pass": 97,
          "bust": 1.2,
          "days": 8.4
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 80,
          "bust": 16.1,
          "days": 7.8
        },
        "wr50": {
          "pass": 90,
          "bust": 8.5,
          "days": 7
        },
        "wr55": {
          "pass": 95,
          "bust": 4.3,
          "days": 6.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 72,
          "bust": 21,
          "days": 8.1
        },
        "wr50": {
          "pass": 83,
          "bust": 13,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.7,
          "days": 6.9
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 77,
          "bust": 20.2,
          "days": 6.5
        },
        "wr50": {
          "pass": 85,
          "bust": 12.7,
          "days": 6
        },
        "wr55": {
          "pass": 92,
          "bust": 7.5,
          "days": 5.4
        }
      }
    }
  },
  "apex-intraday-100k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 3000,
    "TARGET": 6000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 19,
          "bust": 2.4,
          "days": 17.5
        },
        "wr50": {
          "pass": 36,
          "bust": 0.7,
          "days": 17.1
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 7.9,
          "days": 14.8
        },
        "wr50": {
          "pass": 69,
          "bust": 3.2,
          "days": 14.1
        },
        "wr55": {
          "pass": 85,
          "bust": 1.2,
          "days": 13.2
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 66,
          "bust": 16.9,
          "days": 11.9
        },
        "wr50": {
          "pass": 83,
          "bust": 8.6,
          "days": 11
        },
        "wr55": {
          "pass": 92,
          "bust": 4.2,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 57,
          "bust": 21.7,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.3,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 7.8,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.6,
          "days": 10.6
        },
        "wr50": {
          "pass": 76,
          "bust": 13.2,
          "days": 9.9
        },
        "wr55": {
          "pass": 87,
          "bust": 7.6,
          "days": 9.2
        }
      }
    }
  },
  "apex-intraday-150k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 5000,
    "TARGET": 9000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 27,
          "bust": 2.5,
          "days": 16.8
        },
        "wr50": {
          "pass": 47,
          "bust": 0.7,
          "days": 16.3
        },
        "wr55": {
          "pass": 69,
          "bust": 0.2,
          "days": 15.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 59,
          "bust": 8.1,
          "days": 13.6
        },
        "wr50": {
          "pass": 78,
          "bust": 3.3,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 1.2,
          "days": 11.8
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 71,
          "bust": 16.8,
          "days": 11
        },
        "wr50": {
          "pass": 85,
          "bust": 8.8,
          "days": 10.1
        },
        "wr55": {
          "pass": 94,
          "bust": 4.1,
          "days": 9.1
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 56,
          "bust": 21.9,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.3,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 8,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 68,
          "bust": 21.5,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.2,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.8,
          "days": 8.1
        }
      }
    }
  },
  "apex-intraday-250k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 6500,
    "TARGET": 15000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 7,
          "bust": 2.4,
          "days": 18.6
        },
        "wr50": {
          "pass": 17,
          "bust": 0.7,
          "days": 18.4
        },
        "wr55": {
          "pass": 34,
          "bust": 0.2,
          "days": 18.1
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 37,
          "bust": 8,
          "days": 15.9
        },
        "wr50": {
          "pass": 59,
          "bust": 3.3,
          "days": 15.3
        },
        "wr55": {
          "pass": 78,
          "bust": 1.2,
          "days": 14.5
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 57,
          "bust": 16.9,
          "days": 13.5
        },
        "wr50": {
          "pass": 76,
          "bust": 8.8,
          "days": 12.7
        },
        "wr55": {
          "pass": 89,
          "bust": 4.3,
          "days": 11.7
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 44,
          "bust": 21.7,
          "days": 13.2
        },
        "wr50": {
          "pass": 61,
          "bust": 13.3,
          "days": 12.7
        },
        "wr55": {
          "pass": 76,
          "bust": 7.8,
          "days": 12
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 56,
          "bust": 21.7,
          "days": 11.6
        },
        "wr50": {
          "pass": 72,
          "bust": 13.3,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 7.8,
          "days": 10.2
        }
      }
    }
  },
  "apex-intraday-300k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 7500,
    "TARGET": 20000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 3,
          "bust": 2.5,
          "days": 19.2
        },
        "wr50": {
          "pass": 8,
          "bust": 0.7,
          "days": 19.2
        },
        "wr55": {
          "pass": 19,
          "bust": 0.2,
          "days": 19
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 27,
          "bust": 8,
          "days": 16.8
        },
        "wr50": {
          "pass": 47,
          "bust": 3.2,
          "days": 16.3
        },
        "wr55": {
          "pass": 69,
          "bust": 1.2,
          "days": 15.6
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 47,
          "bust": 16.9,
          "days": 14.7
        },
        "wr50": {
          "pass": 68,
          "bust": 8.7,
          "days": 14.1
        },
        "wr55": {
          "pass": 84,
          "bust": 4.4,
          "days": 13.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 38,
          "bust": 22.1,
          "days": 14
        },
        "wr50": {
          "pass": 56,
          "bust": 13.2,
          "days": 13.5
        },
        "wr55": {
          "pass": 72,
          "bust": 7.8,
          "days": 12.9
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 52,
          "bust": 21.5,
          "days": 12.8
        },
        "wr50": {
          "pass": 69,
          "bust": 13.2,
          "days": 12.2
        },
        "wr55": {
          "pass": 82,
          "bust": 7.8,
          "days": 11.3
        }
      }
    }
  },
  "mff-starter-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 2500,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 59,
          "bust": 2.4,
          "days": 13.6
        },
        "wr50": {
          "pass": 78,
          "bust": 0.7,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 0.2,
          "days": 11.8
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 78,
          "bust": 7.9,
          "days": 10.3
        },
        "wr50": {
          "pass": 91,
          "bust": 3.2,
          "days": 9.4
        },
        "wr55": {
          "pass": 97,
          "bust": 1.3,
          "days": 8.3
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 80,
          "bust": 16.2,
          "days": 7.8
        },
        "wr50": {
          "pass": 90,
          "bust": 8.6,
          "days": 7
        },
        "wr55": {
          "pass": 95,
          "bust": 4.1,
          "days": 6.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 72,
          "bust": 21.2,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13.2,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.7,
          "days": 6.9
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 77,
          "bust": 20.3,
          "days": 6.5
        },
        "wr50": {
          "pass": 85,
          "bust": 12.7,
          "days": 6
        },
        "wr55": {
          "pass": 92,
          "bust": 7.4,
          "days": 5.4
        }
      }
    }
  },
  "mff-core-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 2000,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 43,
          "bust": 2.4,
          "days": 15.4
        },
        "wr50": {
          "pass": 64,
          "bust": 0.7,
          "days": 14.8
        },
        "wr55": {
          "pass": 82,
          "bust": 0.2,
          "days": 13.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 69,
          "bust": 7.9,
          "days": 12.1
        },
        "wr50": {
          "pass": 85,
          "bust": 3.2,
          "days": 11.2
        },
        "wr55": {
          "pass": 94,
          "bust": 1.3,
          "days": 10.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 74,
          "bust": 16.8,
          "days": 10
        },
        "wr50": {
          "pass": 87,
          "bust": 8.7,
          "days": 9.2
        },
        "wr55": {
          "pass": 94,
          "bust": 4.3,
          "days": 8.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 68,
          "bust": 21.6,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.5,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.7,
          "days": 8.1
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 73,
          "bust": 21,
          "days": 8.1
        },
        "wr50": {
          "pass": 83,
          "bust": 13.2,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.7,
          "days": 6.9
        }
      }
    }
  },
  "mff-core-100k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 3000,
    "TARGET": 6000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 19,
          "bust": 2.4,
          "days": 17.5
        },
        "wr50": {
          "pass": 36,
          "bust": 0.7,
          "days": 17.1
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 8,
          "days": 14.8
        },
        "wr50": {
          "pass": 69,
          "bust": 3.1,
          "days": 14.2
        },
        "wr55": {
          "pass": 86,
          "bust": 1.2,
          "days": 13.2
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 66,
          "bust": 17.1,
          "days": 11.9
        },
        "wr50": {
          "pass": 83,
          "bust": 8.8,
          "days": 11
        },
        "wr55": {
          "pass": 92,
          "bust": 4.2,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 56,
          "bust": 21.6,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.6,
          "days": 11
        },
        "wr55": {
          "pass": 84,
          "bust": 7.8,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.7,
          "days": 10.5
        },
        "wr50": {
          "pass": 76,
          "bust": 13.2,
          "days": 9.9
        },
        "wr55": {
          "pass": 86,
          "bust": 7.9,
          "days": 9.2
        }
      }
    }
  },
  "mff-scale-150k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 5000,
    "TARGET": 9000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 27,
          "bust": 2.4,
          "days": 16.8
        },
        "wr50": {
          "pass": 48,
          "bust": 0.7,
          "days": 16.3
        },
        "wr55": {
          "pass": 68,
          "bust": 0.1,
          "days": 15.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 59,
          "bust": 7.9,
          "days": 13.6
        },
        "wr50": {
          "pass": 78,
          "bust": 3.3,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 1.2,
          "days": 11.8
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 71,
          "bust": 16.8,
          "days": 11
        },
        "wr50": {
          "pass": 85,
          "bust": 8.8,
          "days": 10.1
        },
        "wr55": {
          "pass": 94,
          "bust": 4.2,
          "days": 9.1
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 56,
          "bust": 21.6,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.2,
          "days": 11
        },
        "wr55": {
          "pass": 84,
          "bust": 7.8,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 69,
          "bust": 21.5,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.2,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.6,
          "days": 8.1
        }
      }
    }
  },
  "lucid-pro-25k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 1000,
    "TARGET": 1250,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 54,
          "bust": 2.4,
          "days": 14.3
        },
        "wr50": {
          "pass": 74,
          "bust": 0.7,
          "days": 13.5
        },
        "wr55": {
          "pass": 89,
          "bust": 0.2,
          "days": 12.5
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 74,
          "bust": 8.1,
          "days": 11.3
        },
        "wr50": {
          "pass": 88,
          "bust": 3.2,
          "days": 10.3
        },
        "wr55": {
          "pass": 96,
          "bust": 1.2,
          "days": 9.3
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 78,
          "bust": 16.4,
          "days": 9
        },
        "wr50": {
          "pass": 89,
          "bust": 8.5,
          "days": 8.1
        },
        "wr55": {
          "pass": 95,
          "bust": 4.3,
          "days": 7.3
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 72,
          "bust": 21.2,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13.1,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.7,
          "days": 6.9
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 72,
          "bust": 21.1,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13.1,
          "days": 7.6
        },
        "wr55": {
          "pass": 91,
          "bust": 7.6,
          "days": 6.9
        }
      }
    }
  },
  "lucid-pro-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 2000,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 43,
          "bust": 2.4,
          "days": 15.4
        },
        "wr50": {
          "pass": 64,
          "bust": 0.7,
          "days": 14.8
        },
        "wr55": {
          "pass": 82,
          "bust": 0.2,
          "days": 13.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 69,
          "bust": 8.1,
          "days": 12.1
        },
        "wr50": {
          "pass": 85,
          "bust": 3.2,
          "days": 11.2
        },
        "wr55": {
          "pass": 94,
          "bust": 1.2,
          "days": 10.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 74,
          "bust": 17,
          "days": 10.1
        },
        "wr50": {
          "pass": 87,
          "bust": 8.6,
          "days": 9.2
        },
        "wr55": {
          "pass": 94,
          "bust": 4.3,
          "days": 8.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 69,
          "bust": 21.4,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.3,
          "days": 8.9
        },
        "wr55": {
          "pass": 89,
          "bust": 7.6,
          "days": 8
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 72,
          "bust": 21.3,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13.1,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.7,
          "days": 6.9
        }
      }
    }
  },
  "lucid-pro-100k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 3000,
    "TARGET": 6000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 18,
          "bust": 2.5,
          "days": 17.5
        },
        "wr50": {
          "pass": 36,
          "bust": 0.7,
          "days": 17.1
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 8.1,
          "days": 14.8
        },
        "wr50": {
          "pass": 69,
          "bust": 3.2,
          "days": 14.1
        },
        "wr55": {
          "pass": 85,
          "bust": 1.1,
          "days": 13.2
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 67,
          "bust": 16.8,
          "days": 11.9
        },
        "wr50": {
          "pass": 82,
          "bust": 9,
          "days": 11
        },
        "wr55": {
          "pass": 92,
          "bust": 4.4,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 57,
          "bust": 21.8,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.3,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 7.8,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.5,
          "days": 10.6
        },
        "wr50": {
          "pass": 76,
          "bust": 13.2,
          "days": 9.9
        },
        "wr55": {
          "pass": 86,
          "bust": 7.8,
          "days": 9.1
        }
      }
    }
  },
  "lucid-pro-150k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 4500,
    "TARGET": 9000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 19,
          "bust": 2.4,
          "days": 17.5
        },
        "wr50": {
          "pass": 37,
          "bust": 0.7,
          "days": 17.1
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 7.9,
          "days": 14.8
        },
        "wr50": {
          "pass": 69,
          "bust": 3.3,
          "days": 14.1
        },
        "wr55": {
          "pass": 85,
          "bust": 1.2,
          "days": 13.2
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 67,
          "bust": 16.8,
          "days": 11.9
        },
        "wr50": {
          "pass": 83,
          "bust": 8.7,
          "days": 11
        },
        "wr55": {
          "pass": 92,
          "bust": 4.2,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 57,
          "bust": 21.9,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.5,
          "days": 11
        },
        "wr55": {
          "pass": 84,
          "bust": 7.9,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.8,
          "days": 10.5
        },
        "wr50": {
          "pass": 76,
          "bust": 13.2,
          "days": 9.9
        },
        "wr55": {
          "pass": 86,
          "bust": 7.7,
          "days": 9.2
        }
      }
    }
  },
  "lucid-flex-25k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 1000,
    "TARGET": 1250,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 54,
          "bust": 2.5,
          "days": 14.3
        },
        "wr50": {
          "pass": 74,
          "bust": 0.7,
          "days": 13.5
        },
        "wr55": {
          "pass": 88,
          "bust": 0.2,
          "days": 12.5
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 74,
          "bust": 8,
          "days": 11.3
        },
        "wr50": {
          "pass": 88,
          "bust": 3.3,
          "days": 10.3
        },
        "wr55": {
          "pass": 96,
          "bust": 1.2,
          "days": 9.3
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 78,
          "bust": 16.5,
          "days": 9
        },
        "wr50": {
          "pass": 89,
          "bust": 8.7,
          "days": 8.2
        },
        "wr55": {
          "pass": 95,
          "bust": 4.3,
          "days": 7.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 72,
          "bust": 21.3,
          "days": 8.1
        },
        "wr50": {
          "pass": 83,
          "bust": 13.3,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.7,
          "days": 6.9
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 72,
          "bust": 21.3,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13.2,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.7,
          "days": 6.9
        }
      }
    }
  },
  "lucid-flex-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 2000,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 43,
          "bust": 2.5,
          "days": 15.4
        },
        "wr50": {
          "pass": 64,
          "bust": 0.7,
          "days": 14.8
        },
        "wr55": {
          "pass": 82,
          "bust": 0.2,
          "days": 13.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 69,
          "bust": 8.1,
          "days": 12.1
        },
        "wr50": {
          "pass": 85,
          "bust": 3.3,
          "days": 11.2
        },
        "wr55": {
          "pass": 94,
          "bust": 1.2,
          "days": 10.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 74,
          "bust": 16.9,
          "days": 10
        },
        "wr50": {
          "pass": 87,
          "bust": 8.6,
          "days": 9.2
        },
        "wr55": {
          "pass": 94,
          "bust": 4.4,
          "days": 8.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 68,
          "bust": 21.3,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.3,
          "days": 8.9
        },
        "wr55": {
          "pass": 89,
          "bust": 7.7,
          "days": 8.1
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 72,
          "bust": 21.3,
          "days": 8.1
        },
        "wr50": {
          "pass": 83,
          "bust": 13.1,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.9,
          "days": 6.9
        }
      }
    }
  },
  "lucid-flex-100k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 3000,
    "TARGET": 6000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 19,
          "bust": 2.5,
          "days": 17.5
        },
        "wr50": {
          "pass": 37,
          "bust": 0.7,
          "days": 17.1
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 8.1,
          "days": 14.8
        },
        "wr50": {
          "pass": 69,
          "bust": 3.3,
          "days": 14.2
        },
        "wr55": {
          "pass": 85,
          "bust": 1.2,
          "days": 13.2
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 67,
          "bust": 16.8,
          "days": 11.9
        },
        "wr50": {
          "pass": 83,
          "bust": 8.7,
          "days": 11
        },
        "wr55": {
          "pass": 92,
          "bust": 4.3,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 57,
          "bust": 21.5,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.3,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 7.9,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.8,
          "days": 10.5
        },
        "wr50": {
          "pass": 76,
          "bust": 13.3,
          "days": 9.9
        },
        "wr55": {
          "pass": 86,
          "bust": 7.8,
          "days": 9.2
        }
      }
    }
  },
  "lucid-flex-150k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 4500,
    "TARGET": 9000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 19,
          "bust": 2.5,
          "days": 17.5
        },
        "wr50": {
          "pass": 36,
          "bust": 0.7,
          "days": 17.1
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 8,
          "days": 14.8
        },
        "wr50": {
          "pass": 69,
          "bust": 3.2,
          "days": 14.2
        },
        "wr55": {
          "pass": 85,
          "bust": 1.2,
          "days": 13.2
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 66,
          "bust": 16.9,
          "days": 11.9
        },
        "wr50": {
          "pass": 83,
          "bust": 8.6,
          "days": 11
        },
        "wr55": {
          "pass": 92,
          "bust": 4.3,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 56,
          "bust": 21.7,
          "days": 11.6
        },
        "wr50": {
          "pass": 72,
          "bust": 13.5,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 7.7,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.6,
          "days": 10.5
        },
        "wr50": {
          "pass": 76,
          "bust": 13.2,
          "days": 9.9
        },
        "wr55": {
          "pass": 86,
          "bust": 7.8,
          "days": 9.2
        }
      }
    }
  },
  "lucid-direct-25k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 1000,
    "TARGET": 1500,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 43,
          "bust": 2.5,
          "days": 15.4
        },
        "wr50": {
          "pass": 64,
          "bust": 0.7,
          "days": 14.7
        },
        "wr55": {
          "pass": 82,
          "bust": 0.2,
          "days": 13.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 69,
          "bust": 8,
          "days": 12.1
        },
        "wr50": {
          "pass": 86,
          "bust": 3.2,
          "days": 11.2
        },
        "wr55": {
          "pass": 94,
          "bust": 1.2,
          "days": 10.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 74,
          "bust": 16.7,
          "days": 10
        },
        "wr50": {
          "pass": 87,
          "bust": 8.7,
          "days": 9.2
        },
        "wr55": {
          "pass": 94,
          "bust": 4.3,
          "days": 8.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 68,
          "bust": 21.5,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.2,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.6,
          "days": 8
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 72,
          "bust": 21.1,
          "days": 8.1
        },
        "wr50": {
          "pass": 83,
          "bust": 13.2,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.6,
          "days": 6.9
        }
      }
    }
  },
  "lucid-direct-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 2000,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 43,
          "bust": 2.5,
          "days": 15.4
        },
        "wr50": {
          "pass": 64,
          "bust": 0.7,
          "days": 14.7
        },
        "wr55": {
          "pass": 82,
          "bust": 0.2,
          "days": 13.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 70,
          "bust": 8,
          "days": 12.1
        },
        "wr50": {
          "pass": 85,
          "bust": 3.2,
          "days": 11.2
        },
        "wr55": {
          "pass": 94,
          "bust": 1.2,
          "days": 10.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 75,
          "bust": 16.4,
          "days": 10
        },
        "wr50": {
          "pass": 87,
          "bust": 8.7,
          "days": 9.1
        },
        "wr55": {
          "pass": 94,
          "bust": 4.3,
          "days": 8.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 69,
          "bust": 21.4,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.1,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.7,
          "days": 8
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 73,
          "bust": 20.9,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13.2,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.6,
          "days": 6.9
        }
      }
    }
  },
  "lucid-direct-100k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 3500,
    "TARGET": 6000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 27,
          "bust": 2.5,
          "days": 16.7
        },
        "wr50": {
          "pass": 47,
          "bust": 0.7,
          "days": 16.3
        },
        "wr55": {
          "pass": 69,
          "bust": 0.2,
          "days": 15.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 59,
          "bust": 7.9,
          "days": 13.6
        },
        "wr50": {
          "pass": 78,
          "bust": 3.3,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 1.2,
          "days": 11.8
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 71,
          "bust": 16.7,
          "days": 11
        },
        "wr50": {
          "pass": 85,
          "bust": 8.8,
          "days": 10.1
        },
        "wr55": {
          "pass": 93,
          "bust": 4.3,
          "days": 9.1
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 62,
          "bust": 21.6,
          "days": 10.5
        },
        "wr50": {
          "pass": 76,
          "bust": 13.3,
          "days": 9.9
        },
        "wr55": {
          "pass": 87,
          "bust": 7.7,
          "days": 9.1
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 69,
          "bust": 21.4,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.8,
          "days": 8
        }
      }
    }
  },
  "lucid-direct-150k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 5000,
    "TARGET": 9000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 27,
          "bust": 2.5,
          "days": 16.8
        },
        "wr50": {
          "pass": 47,
          "bust": 0.7,
          "days": 16.3
        },
        "wr55": {
          "pass": 69,
          "bust": 0.2,
          "days": 15.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 59,
          "bust": 8,
          "days": 13.6
        },
        "wr50": {
          "pass": 78,
          "bust": 3.2,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 1.2,
          "days": 11.7
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 71,
          "bust": 16.8,
          "days": 11
        },
        "wr50": {
          "pass": 85,
          "bust": 8.8,
          "days": 10.1
        },
        "wr55": {
          "pass": 93,
          "bust": 4.3,
          "days": 9.1
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 57,
          "bust": 21.7,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.3,
          "days": 11
        },
        "wr55": {
          "pass": 84,
          "bust": 7.9,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 68,
          "bust": 21.5,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.5,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.7,
          "days": 8.1
        }
      }
    }
  },
  "tradeify-select-25k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 1000,
    "TARGET": 1500,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 43,
          "bust": 2.4,
          "days": 15.4
        },
        "wr50": {
          "pass": 64,
          "bust": 0.7,
          "days": 14.7
        },
        "wr55": {
          "pass": 82,
          "bust": 0.2,
          "days": 13.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 70,
          "bust": 7.9,
          "days": 12.1
        },
        "wr50": {
          "pass": 85,
          "bust": 3.3,
          "days": 11.2
        },
        "wr55": {
          "pass": 94,
          "bust": 1.3,
          "days": 10.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 75,
          "bust": 16.6,
          "days": 10
        },
        "wr50": {
          "pass": 87,
          "bust": 8.9,
          "days": 9.2
        },
        "wr55": {
          "pass": 94,
          "bust": 4.2,
          "days": 8.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 68,
          "bust": 21.4,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.4,
          "days": 8.8
        },
        "wr55": {
          "pass": 89,
          "bust": 7.9,
          "days": 8
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 72,
          "bust": 21.1,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13.3,
          "days": 7.6
        },
        "wr55": {
          "pass": 91,
          "bust": 7.5,
          "days": 6.9
        }
      }
    }
  },
  "tradeify-select-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 2000,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 43,
          "bust": 2.5,
          "days": 15.4
        },
        "wr50": {
          "pass": 64,
          "bust": 0.7,
          "days": 14.8
        },
        "wr55": {
          "pass": 82,
          "bust": 0.1,
          "days": 13.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 69,
          "bust": 7.9,
          "days": 12.1
        },
        "wr50": {
          "pass": 85,
          "bust": 3.3,
          "days": 11.2
        },
        "wr55": {
          "pass": 94,
          "bust": 1.2,
          "days": 10.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 74,
          "bust": 16.8,
          "days": 10
        },
        "wr50": {
          "pass": 87,
          "bust": 8.7,
          "days": 9.2
        },
        "wr55": {
          "pass": 94,
          "bust": 4.2,
          "days": 8.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 69,
          "bust": 21.2,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.3,
          "days": 8.9
        },
        "wr55": {
          "pass": 89,
          "bust": 7.7,
          "days": 8.1
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 72,
          "bust": 21.2,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13,
          "days": 7.6
        },
        "wr55": {
          "pass": 91,
          "bust": 7.6,
          "days": 6.9
        }
      }
    }
  },
  "tradeify-select-100k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 3000,
    "TARGET": 6000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 18,
          "bust": 2.5,
          "days": 17.5
        },
        "wr50": {
          "pass": 37,
          "bust": 0.7,
          "days": 17.1
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 8.1,
          "days": 14.9
        },
        "wr50": {
          "pass": 69,
          "bust": 3.3,
          "days": 14.1
        },
        "wr55": {
          "pass": 85,
          "bust": 1.2,
          "days": 13.2
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 67,
          "bust": 16.7,
          "days": 11.9
        },
        "wr50": {
          "pass": 83,
          "bust": 8.8,
          "days": 11.1
        },
        "wr55": {
          "pass": 92,
          "bust": 4.2,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 56,
          "bust": 21.6,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.4,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 7.9,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.4,
          "days": 10.6
        },
        "wr50": {
          "pass": 76,
          "bust": 13.4,
          "days": 9.9
        },
        "wr55": {
          "pass": 86,
          "bust": 7.8,
          "days": 9.1
        }
      }
    }
  },
  "tradeify-select-150k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 4500,
    "TARGET": 9000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 19,
          "bust": 2.5,
          "days": 17.5
        },
        "wr50": {
          "pass": 37,
          "bust": 0.7,
          "days": 17.2
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 8.1,
          "days": 14.8
        },
        "wr50": {
          "pass": 69,
          "bust": 3.3,
          "days": 14.1
        },
        "wr55": {
          "pass": 85,
          "bust": 1.2,
          "days": 13.2
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 67,
          "bust": 16.7,
          "days": 11.9
        },
        "wr50": {
          "pass": 82,
          "bust": 8.7,
          "days": 11
        },
        "wr55": {
          "pass": 92,
          "bust": 4.2,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 57,
          "bust": 21.5,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.5,
          "days": 11
        },
        "wr55": {
          "pass": 84,
          "bust": 7.8,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.6,
          "days": 10.5
        },
        "wr50": {
          "pass": 76,
          "bust": 13.2,
          "days": 9.9
        },
        "wr55": {
          "pass": 86,
          "bust": 7.8,
          "days": 9.2
        }
      }
    }
  },
  "ylos-challenge-25k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 1500,
    "TARGET": 1500,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 70,
          "bust": 2.5,
          "days": 12.2
        },
        "wr50": {
          "pass": 86,
          "bust": 0.7,
          "days": 11.3
        },
        "wr55": {
          "pass": 95,
          "bust": 0.2,
          "days": 10.2
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 82,
          "bust": 7.8,
          "days": 9.4
        },
        "wr50": {
          "pass": 93,
          "bust": 3.2,
          "days": 8.4
        },
        "wr55": {
          "pass": 97,
          "bust": 1.2,
          "days": 7.4
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 83,
          "bust": 15.7,
          "days": 6.7
        },
        "wr50": {
          "pass": 91,
          "bust": 8.4,
          "days": 6
        },
        "wr55": {
          "pass": 96,
          "bust": 4.1,
          "days": 5.3
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 76,
          "bust": 20.3,
          "days": 6.5
        },
        "wr50": {
          "pass": 86,
          "bust": 12.6,
          "days": 6
        },
        "wr55": {
          "pass": 92,
          "bust": 7.4,
          "days": 5.4
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 77,
          "bust": 20.1,
          "days": 6.5
        },
        "wr50": {
          "pass": 86,
          "bust": 12.6,
          "days": 6
        },
        "wr55": {
          "pass": 92,
          "bust": 7.6,
          "days": 5.4
        }
      }
    }
  },
  "ylos-challenge-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 2500,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 59,
          "bust": 2.4,
          "days": 13.7
        },
        "wr50": {
          "pass": 78,
          "bust": 0.7,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 0.2,
          "days": 11.8
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 78,
          "bust": 7.9,
          "days": 10.3
        },
        "wr50": {
          "pass": 91,
          "bust": 3.2,
          "days": 9.4
        },
        "wr55": {
          "pass": 97,
          "bust": 1.2,
          "days": 8.3
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 80,
          "bust": 16.2,
          "days": 7.8
        },
        "wr50": {
          "pass": 90,
          "bust": 8.6,
          "days": 7
        },
        "wr55": {
          "pass": 95,
          "bust": 4.2,
          "days": 6.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 72,
          "bust": 21.3,
          "days": 8.2
        },
        "wr50": {
          "pass": 83,
          "bust": 13,
          "days": 7.6
        },
        "wr55": {
          "pass": 90,
          "bust": 7.7,
          "days": 6.9
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 77,
          "bust": 20,
          "days": 6.5
        },
        "wr50": {
          "pass": 86,
          "bust": 12.4,
          "days": 6
        },
        "wr55": {
          "pass": 92,
          "bust": 7.5,
          "days": 5.4
        }
      }
    }
  },
  "ylos-challenge-100k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 3000,
    "TARGET": 6000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 18,
          "bust": 2.5,
          "days": 17.5
        },
        "wr50": {
          "pass": 36,
          "bust": 0.7,
          "days": 17.2
        },
        "wr55": {
          "pass": 58,
          "bust": 0.2,
          "days": 16.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 48,
          "bust": 7.8,
          "days": 14.8
        },
        "wr50": {
          "pass": 69,
          "bust": 3.2,
          "days": 14.1
        },
        "wr55": {
          "pass": 85,
          "bust": 1.2,
          "days": 13.3
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 67,
          "bust": 16.7,
          "days": 11.9
        },
        "wr50": {
          "pass": 82,
          "bust": 8.9,
          "days": 11
        },
        "wr55": {
          "pass": 92,
          "bust": 4.3,
          "days": 10
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 56,
          "bust": 21.8,
          "days": 11.6
        },
        "wr50": {
          "pass": 72,
          "bust": 13.4,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 7.8,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 62,
          "bust": 21.7,
          "days": 10.5
        },
        "wr50": {
          "pass": 76,
          "bust": 13.1,
          "days": 9.9
        },
        "wr55": {
          "pass": 86,
          "bust": 7.8,
          "days": 9.1
        }
      }
    }
  },
  "ylos-challenge-150k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 5000,
    "TARGET": 9000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 27,
          "bust": 2.5,
          "days": 16.7
        },
        "wr50": {
          "pass": 47,
          "bust": 0.7,
          "days": 16.3
        },
        "wr55": {
          "pass": 69,
          "bust": 0.2,
          "days": 15.6
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 59,
          "bust": 7.9,
          "days": 13.6
        },
        "wr50": {
          "pass": 78,
          "bust": 3.3,
          "days": 12.8
        },
        "wr55": {
          "pass": 91,
          "bust": 1.2,
          "days": 11.8
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 71,
          "bust": 16.8,
          "days": 11
        },
        "wr50": {
          "pass": 85,
          "bust": 8.8,
          "days": 10.1
        },
        "wr55": {
          "pass": 94,
          "bust": 4.2,
          "days": 9.1
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 56,
          "bust": 21.6,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.4,
          "days": 10.9
        },
        "wr55": {
          "pass": 84,
          "bust": 7.8,
          "days": 10.2
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 68,
          "bust": 21.6,
          "days": 9.5
        },
        "wr50": {
          "pass": 81,
          "bust": 13.5,
          "days": 8.9
        },
        "wr55": {
          "pass": 89,
          "bust": 7.8,
          "days": 8.1
        }
      }
    }
  },
  "ylos-challenge-250k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 6500,
    "TARGET": 15000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 7,
          "bust": 2.4,
          "days": 18.7
        },
        "wr50": {
          "pass": 18,
          "bust": 0.7,
          "days": 18.4
        },
        "wr55": {
          "pass": 34,
          "bust": 0.2,
          "days": 18.1
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 37,
          "bust": 8.1,
          "days": 15.9
        },
        "wr50": {
          "pass": 59,
          "bust": 3.4,
          "days": 15.3
        },
        "wr55": {
          "pass": 78,
          "bust": 1.1,
          "days": 14.5
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 57,
          "bust": 16.8,
          "days": 13.5
        },
        "wr50": {
          "pass": 76,
          "bust": 8.7,
          "days": 12.7
        },
        "wr55": {
          "pass": 89,
          "bust": 4.2,
          "days": 11.7
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 44,
          "bust": 21.6,
          "days": 13.2
        },
        "wr50": {
          "pass": 61,
          "bust": 13.4,
          "days": 12.7
        },
        "wr55": {
          "pass": 76,
          "bust": 7.7,
          "days": 12
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 56,
          "bust": 21.5,
          "days": 11.5
        },
        "wr50": {
          "pass": 72,
          "bust": 13.4,
          "days": 11
        },
        "wr55": {
          "pass": 84,
          "bust": 7.7,
          "days": 10.2
        }
      }
    }
  },
  "ylos-challenge-300k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 7500,
    "TARGET": 20000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 3,
          "bust": 2.5,
          "days": 19.3
        },
        "wr50": {
          "pass": 8,
          "bust": 0.7,
          "days": 19.2
        },
        "wr55": {
          "pass": 19,
          "bust": 0.2,
          "days": 19
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 27,
          "bust": 8,
          "days": 16.8
        },
        "wr50": {
          "pass": 47,
          "bust": 3.2,
          "days": 16.3
        },
        "wr55": {
          "pass": 69,
          "bust": 1.2,
          "days": 15.6
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 47,
          "bust": 16.8,
          "days": 14.7
        },
        "wr50": {
          "pass": 68,
          "bust": 8.7,
          "days": 14
        },
        "wr55": {
          "pass": 84,
          "bust": 4.3,
          "days": 13.2
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 38,
          "bust": 21.8,
          "days": 14
        },
        "wr50": {
          "pass": 56,
          "bust": 13.2,
          "days": 13.5
        },
        "wr55": {
          "pass": 72,
          "bust": 7.8,
          "days": 12.8
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 52,
          "bust": 21.7,
          "days": 12.8
        },
        "wr50": {
          "pass": 69,
          "bust": 13.4,
          "days": 12.1
        },
        "wr55": {
          "pass": 82,
          "bust": 7.9,
          "days": 11.4
        }
      }
    }
  },
  "ylos-freedom-50k": {
    "recommendedProfile": "CONS_B",
    "days": 21,
    "DD": 1200,
    "TARGET": 3000,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 5,
          "bust": 2.4,
          "days": 18.8
        },
        "wr50": {
          "pass": 14,
          "bust": 0.7,
          "days": 18.7
        },
        "wr55": {
          "pass": 29,
          "bust": 0.2,
          "days": 18.4
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 32,
          "bust": 8.1,
          "days": 16.3
        },
        "wr50": {
          "pass": 53,
          "bust": 3.2,
          "days": 15.8
        },
        "wr55": {
          "pass": 74,
          "bust": 1.2,
          "days": 15.1
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 52,
          "bust": 16.9,
          "days": 14.1
        },
        "wr50": {
          "pass": 72,
          "bust": 8.8,
          "days": 13.4
        },
        "wr55": {
          "pass": 87,
          "bust": 4.4,
          "days": 12.4
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 44,
          "bust": 21.9,
          "days": 13.3
        },
        "wr50": {
          "pass": 61,
          "bust": 13.2,
          "days": 12.7
        },
        "wr55": {
          "pass": 76,
          "bust": 7.8,
          "days": 12
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 52,
          "bust": 21.8,
          "days": 12.8
        },
        "wr50": {
          "pass": 69,
          "bust": 13.3,
          "days": 12.2
        },
        "wr55": {
          "pass": 82,
          "bust": 7.8,
          "days": 11.3
        }
      }
    }
  },
  "zero7-trainee": {
    "recommendedProfile": "CONS_A",
    "days": 42,
    "DD": 997,
    "TARGET": 997,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 92,
          "bust": 3.2,
          "days": 16.9
        },
        "wr50": {
          "pass": 98,
          "bust": 0.8,
          "days": 13.9
        },
        "wr55": {
          "pass": 100,
          "bust": 0.2,
          "days": 11.4
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 91,
          "bust": 8.5,
          "days": 11.1
        },
        "wr50": {
          "pass": 97,
          "bust": 3.2,
          "days": 9.2
        },
        "wr55": {
          "pass": 99,
          "bust": 1.2,
          "days": 7.7
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 85,
          "bust": 15.2,
          "days": 7.1
        },
        "wr50": {
          "pass": 92,
          "bust": 7.9,
          "days": 6.2
        },
        "wr55": {
          "pass": 96,
          "bust": 4,
          "days": 5.4
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 79,
          "bust": 20.9,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 12.8,
          "days": 6.4
        },
        "wr55": {
          "pass": 92,
          "bust": 7.7,
          "days": 5.6
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 79,
          "bust": 21.2,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 13,
          "days": 6.4
        },
        "wr55": {
          "pass": 92,
          "bust": 7.7,
          "days": 5.6
        }
      }
    }
  },
  "zero7-junior": {
    "recommendedProfile": "CONS_A",
    "days": 42,
    "DD": 1997,
    "TARGET": 1997,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 92,
          "bust": 3.2,
          "days": 16.2
        },
        "wr50": {
          "pass": 98,
          "bust": 0.8,
          "days": 13.3
        },
        "wr55": {
          "pass": 100,
          "bust": 0.2,
          "days": 10.9
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 91,
          "bust": 8.6,
          "days": 11.1
        },
        "wr50": {
          "pass": 97,
          "bust": 3.3,
          "days": 9.2
        },
        "wr55": {
          "pass": 99,
          "bust": 1.1,
          "days": 7.7
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 84,
          "bust": 16.1,
          "days": 7
        },
        "wr50": {
          "pass": 92,
          "bust": 8.4,
          "days": 6.1
        },
        "wr55": {
          "pass": 96,
          "bust": 4.2,
          "days": 5.3
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 79,
          "bust": 21,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 13,
          "days": 6.4
        },
        "wr55": {
          "pass": 92,
          "bust": 7.6,
          "days": 5.6
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 79,
          "bust": 21.2,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 13,
          "days": 6.3
        },
        "wr55": {
          "pass": 92,
          "bust": 7.6,
          "days": 5.6
        }
      }
    }
  },
  "zero7-pleno": {
    "recommendedProfile": "CONS_A",
    "days": 42,
    "DD": 4997,
    "TARGET": 4997,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 93,
          "bust": 2.3,
          "days": 16.3
        },
        "wr50": {
          "pass": 99,
          "bust": 0.5,
          "days": 13.4
        },
        "wr55": {
          "pass": 100,
          "bust": 0.1,
          "days": 11
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 91,
          "bust": 8.6,
          "days": 11.1
        },
        "wr50": {
          "pass": 97,
          "bust": 3.3,
          "days": 9.2
        },
        "wr55": {
          "pass": 99,
          "bust": 1.2,
          "days": 7.7
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 84,
          "bust": 16.1,
          "days": 7
        },
        "wr50": {
          "pass": 92,
          "bust": 8.4,
          "days": 6.1
        },
        "wr55": {
          "pass": 96,
          "bust": 4.2,
          "days": 5.4
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 79,
          "bust": 21,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 12.9,
          "days": 6.4
        },
        "wr55": {
          "pass": 93,
          "bust": 7.5,
          "days": 5.6
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 79,
          "bust": 21,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 12.9,
          "days": 6.4
        },
        "wr55": {
          "pass": 92,
          "bust": 7.6,
          "days": 5.6
        }
      }
    }
  },
  "zero7-senior": {
    "recommendedProfile": "CONS_A",
    "days": 42,
    "DD": 9997,
    "TARGET": 9997,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 92,
          "bust": 3.1,
          "days": 16.2
        },
        "wr50": {
          "pass": 98,
          "bust": 0.8,
          "days": 13.3
        },
        "wr55": {
          "pass": 100,
          "bust": 0.2,
          "days": 11
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 91,
          "bust": 8.7,
          "days": 11.1
        },
        "wr50": {
          "pass": 97,
          "bust": 3.4,
          "days": 9.2
        },
        "wr55": {
          "pass": 99,
          "bust": 1.2,
          "days": 7.7
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 84,
          "bust": 16,
          "days": 7
        },
        "wr50": {
          "pass": 92,
          "bust": 8.3,
          "days": 6.1
        },
        "wr55": {
          "pass": 96,
          "bust": 4.2,
          "days": 5.3
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 79,
          "bust": 21.1,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 13,
          "days": 6.4
        },
        "wr55": {
          "pass": 92,
          "bust": 7.7,
          "days": 5.6
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 79,
          "bust": 20.9,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 13,
          "days": 6.3
        },
        "wr55": {
          "pass": 93,
          "bust": 7.5,
          "days": 5.6
        }
      }
    }
  },
  "zero7-expert": {
    "recommendedProfile": "CONS_A",
    "days": 42,
    "DD": 14997,
    "TARGET": 14997,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 92,
          "bust": 3.2,
          "days": 16.9
        },
        "wr50": {
          "pass": 98,
          "bust": 0.8,
          "days": 13.9
        },
        "wr55": {
          "pass": 100,
          "bust": 0.2,
          "days": 11.5
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 91,
          "bust": 8.7,
          "days": 11.1
        },
        "wr50": {
          "pass": 96,
          "bust": 3.4,
          "days": 9.2
        },
        "wr55": {
          "pass": 99,
          "bust": 1.2,
          "days": 7.7
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 85,
          "bust": 15.1,
          "days": 7.2
        },
        "wr50": {
          "pass": 92,
          "bust": 8,
          "days": 6.2
        },
        "wr55": {
          "pass": 96,
          "bust": 4,
          "days": 5.4
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 79,
          "bust": 20.9,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 12.9,
          "days": 6.3
        },
        "wr55": {
          "pass": 92,
          "bust": 7.7,
          "days": 5.6
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 79,
          "bust": 21.3,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 13,
          "days": 6.4
        },
        "wr55": {
          "pass": 92,
          "bust": 7.7,
          "days": 5.6
        }
      }
    }
  },
  "zero7-master": {
    "recommendedProfile": "CONS_A",
    "days": 42,
    "DD": 19997,
    "TARGET": 19997,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 92,
          "bust": 3.1,
          "days": 16.5
        },
        "wr50": {
          "pass": 98,
          "bust": 0.8,
          "days": 13.6
        },
        "wr55": {
          "pass": 100,
          "bust": 0.2,
          "days": 11.1
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 91,
          "bust": 8.6,
          "days": 11.1
        },
        "wr50": {
          "pass": 96,
          "bust": 3.5,
          "days": 9.2
        },
        "wr55": {
          "pass": 99,
          "bust": 1.2,
          "days": 7.7
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 84,
          "bust": 15.9,
          "days": 7
        },
        "wr50": {
          "pass": 92,
          "bust": 8.4,
          "days": 6.1
        },
        "wr55": {
          "pass": 96,
          "bust": 4.2,
          "days": 5.3
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 79,
          "bust": 21.1,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 12.8,
          "days": 6.3
        },
        "wr55": {
          "pass": 92,
          "bust": 7.6,
          "days": 5.6
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 79,
          "bust": 21.2,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 12.8,
          "days": 6.3
        },
        "wr55": {
          "pass": 93,
          "bust": 7.5,
          "days": 5.6
        }
      }
    }
  },
  "zero7-bit-8": {
    "recommendedProfile": "CONS_A",
    "days": 42,
    "DD": 997,
    "TARGET": 997,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 92,
          "bust": 3.1,
          "days": 17
        },
        "wr50": {
          "pass": 98,
          "bust": 0.8,
          "days": 14
        },
        "wr55": {
          "pass": 100,
          "bust": 0.2,
          "days": 11.5
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 91,
          "bust": 8.6,
          "days": 11.1
        },
        "wr50": {
          "pass": 97,
          "bust": 3.4,
          "days": 9.2
        },
        "wr55": {
          "pass": 99,
          "bust": 1.2,
          "days": 7.7
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 85,
          "bust": 15.2,
          "days": 7.1
        },
        "wr50": {
          "pass": 92,
          "bust": 8.1,
          "days": 6.2
        },
        "wr55": {
          "pass": 96,
          "bust": 4.1,
          "days": 5.4
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 79,
          "bust": 21.1,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 12.9,
          "days": 6.3
        },
        "wr55": {
          "pass": 92,
          "bust": 7.6,
          "days": 5.6
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 79,
          "bust": 21.2,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 13.1,
          "days": 6.4
        },
        "wr55": {
          "pass": 93,
          "bust": 7.5,
          "days": 5.6
        }
      }
    }
  },
  "zero7-bit-16": {
    "recommendedProfile": "CONS_A",
    "days": 42,
    "DD": 1997,
    "TARGET": 1997,
    "mcStats": {
      "CONS_A": {
        "wr45": {
          "pass": 92,
          "bust": 3.2,
          "days": 16.2
        },
        "wr50": {
          "pass": 98,
          "bust": 0.9,
          "days": 13.3
        },
        "wr55": {
          "pass": 100,
          "bust": 0.2,
          "days": 11
        }
      },
      "CONS_B": {
        "wr45": {
          "pass": 91,
          "bust": 8.7,
          "days": 11.1
        },
        "wr50": {
          "pass": 97,
          "bust": 3.3,
          "days": 9.2
        },
        "wr55": {
          "pass": 99,
          "bust": 1.2,
          "days": 7.7
        }
      },
      "CONS_C": {
        "wr45": {
          "pass": 84,
          "bust": 15.8,
          "days": 7
        },
        "wr50": {
          "pass": 92,
          "bust": 8.3,
          "days": 6.1
        },
        "wr55": {
          "pass": 96,
          "bust": 4.1,
          "days": 5.3
        }
      },
      "AGRES_A": {
        "wr45": {
          "pass": 79,
          "bust": 21.2,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 12.9,
          "days": 6.4
        },
        "wr55": {
          "pass": 92,
          "bust": 7.6,
          "days": 5.6
        }
      },
      "AGRES_B": {
        "wr45": {
          "pass": 79,
          "bust": 21.2,
          "days": 7.1
        },
        "wr50": {
          "pass": 87,
          "bust": 13.1,
          "days": 6.3
        },
        "wr55": {
          "pass": 92,
          "bust": 7.5,
          "days": 5.6
        }
      }
    }
  }
};
