/* fashionistas.ai crosslister — the ONLY file that contains selectors.
 *
 * Rules for this codebase:
 *   1. Every CSS selector for every shop lives here, keyed by shop.
 *   2. fill.js / background.js read globalThis.FASHIONISTAS_CONFIG and never
 *      hard-code a selector of their own.
 *   3. Every array of selectors is named `selectors` so the selector count is
 *      exactly: sum of all arrays keyed "selectors".
 *
 * Loaded two ways:
 *   - background service worker: importScripts("config.js")
 *   - content script: listed before fill.js in manifest.json
 */
(function (root) {
  "use strict";

  /* Dropdown / listbox option shapes shared by the six shops. */
  var OPTION_SELECTORS = [
    '[role="option"]',
    '[role="listbox"] li',
    '[role="menu"] [role^="menuitem"]',
    '[role="menu"] li',
    '[role="menuitemradio"]',
    '[role="radio"]',
    '[role="treeitem"]',
    "ul li[class]",
    "[data-testid*='option' i]"
  ];

  /* Image file inputs shared by the six shops (last-resort candidates). */
  var IMAGE_FILE_SELECTORS = [
    'input[type="file"][accept*="image"]',
    'input[type="file"][accept*=".jpg"], input[type="file"][accept*=".png"]',
    'input[type="file"]'
  ];

  var SUBMIT_COMMON = [
    'button[type="submit"]',
    '[data-testid*="publish" i]',
    '[data-testid*="submit" i]',
    'button[aria-label*="publish" i]',
    'div[role="button"][aria-label*="publish" i]'
  ];

  var SUBMIT_TEXT = [
    "publish",
    "publish listing",
    "publish item",
    "post listing",
    "post item",
    "post to depop",
    "list item",
    "list now",
    "submit",
    "submit listing"
  ];

  root.FASHIONISTAS_CONFIG = {
    version: "1.0.0",

    /* Display name lookup + default shop order. */
    shops: {
      /* ------------------------------------------------------ Poshmark */
      poshmark: {
        label: "Poshmark",
        tabMatch: ["https://poshmark.com/*", "https://www.poshmark.com/*"],
        createUrls: ["https://poshmark.com/create-listing"],
        readyDelayMs: 700,
        limits: { title: 80, description: 0 },
        price: { prefix: "$", decimals: 2 },
        fields: {
          title: {
            kind: "text",
            label: "Title",
            selectors: [
              'input[name="title"]',
              'input[placeholder*="title" i]',
              'input[aria-label*="title" i]',
              "#title"
            ]
          },
          description: {
            kind: "textarea",
            label: "Description",
            selectors: [
              'textarea[name="description"]',
              'textarea[placeholder*="description" i]',
              'textarea[aria-label*="description" i]',
              "#description"
            ]
          },
          price: {
            kind: "text",
            label: "Price",
            labelAliases: ["Listing price", "Your price"],
            selectors: [
              'input[aria-label*="listing price" i]',
              'input[name="price"]',
              'input[placeholder*="price" i]',
              'input[aria-label*="price" i]',
              'input[placeholder="$"]'
            ]
          },
          category: {
            kind: "combo",
            label: "Category",
            selectors: [
              '[data-testid="category"]',
              'button[aria-haspopup="listbox"][aria-label*="category" i]',
              'div[class*="category" i] > button',
              'input[placeholder*="category" i]'
            ]
          },
          brand: {
            kind: "text",
            label: "Brand",
            selectors: [
              'input[name="brand"]',
              'input[placeholder*="brand" i]',
              'input[aria-label*="brand" i]'
            ]
          },
          size: {
            kind: "combo",
            label: "Size",
            labelAliases: ["Select size", "Choose size"],
            selectors: [
              '[data-testid*="size" i]',
              'div[class*="size" i] button',
              'input[placeholder*="size" i]',
              'button[aria-label*="size" i]'
            ]
          },
          condition: {
            kind: "combo",
            optional: true,
            label: "Condition",
            selectors: [
              '[data-testid*="condition" i]',
              'input[aria-label*="condition" i]',
              'button[aria-label*="condition" i]',
              'div[class*="condition" i] button'
            ]
          },
          tags: {
            kind: "hashtags",
            mode: "append-description",
            max: 5,
            label: "Style tags / hashtags"
          }
        },
        photos: {
          selectors: [
            '[data-testid*="photo" i] input[type="file"]',
            'label[class*="photo" i] input[type="file"]',
            'input[type="file"][accept*="image"]',
            'input[type="file"]'
          ],
          reveal: {
            selectors: ['label[class*="upload" i]', 'div[class*="photo" i]'],
            textMatchers: ["add photos", "upload photos", "select photos", "photo"]
          }
        },
        submit: {
          selectors: [
            'button[data-testid*="publish" i]',
            'button[class*="publish" i]',
            'button[type="submit"]'
          ],
          textMatchers: SUBMIT_TEXT
        }
      },

      /* ------------------------------------------------------- Mercari */
      mercari: {
        label: "Mercari",
        tabMatch: ["https://www.mercari.com/*", "https://mercari.com/*"],
        createUrls: ["https://www.mercari.com/sell/"],
        readyDelayMs: 700,
        limits: { title: 80, description: 0 },
        price: { prefix: "$", decimals: 2 },
        fields: {
          title: {
            kind: "text",
            label: "Item name",
            labelAliases: ["Title"],
            selectors: [
              'input[aria-label*="item name" i]',
              'input[name="itemName"]',
              'input[placeholder*="item name" i]',
              "#item-name",
              'input[name="title"]'
            ]
          },
          description: {
            kind: "textarea",
            label: "Description",
            selectors: [
              'textarea[name="description"]',
              'textarea[aria-label*="description" i]',
              'textarea[placeholder*="description" i]',
              'textarea[id*="description" i]'
            ]
          },
          price: {
            kind: "text",
            label: "Price",
            selectors: [
              'input[aria-label*="price" i]',
              'input[name="price"]',
              'input[placeholder*="price" i]',
              'input[data-testid*="price" i]'
            ]
          },
          category: {
            kind: "combo",
            label: "Category",
            selectors: [
              'input[aria-label*="category" i]',
              '[data-testid*="category" i]',
              'div[class*="category" i] input',
              'div[class*="category" i] button'
            ]
          },
          brand: {
            kind: "text",
            label: "Brand",
            optional: true,
            selectors: [
              'input[aria-label*="brand" i]',
              'input[name="brand"]',
              'input[placeholder*="brand" i]'
            ]
          },
          size: {
            kind: "combo",
            optional: true,
            label: "Size",
            selectors: [
              'input[aria-label*="size" i]',
              '[data-testid*="size" i]',
              'div[class*="size" i] input',
              'div[class*="size" i] button'
            ]
          },
          condition: {
            kind: "combo",
            label: "Condition",
            selectors: [
              'select[name="condition"]',
              'input[aria-label*="condition" i]',
              '[data-testid*="condition" i]',
              'div[class*="condition" i] button'
            ]
          },
          tags: {
            kind: "hashtags",
            mode: "append-description",
            max: 3,
            label: "Hashtags"
          }
        },
        photos: {
          selectors: IMAGE_FILE_SELECTORS,
          reveal: {
            selectors: ['div[class*="upload" i]', 'button[class*="upload" i]'],
            textMatchers: ["add photos", "upload", "select photos"]
          }
        },
        submit: {
          selectors: SUBMIT_COMMON,
          textMatchers: SUBMIT_TEXT
        }
      },

      /* --------------------------------------------------------- Depop */
      depop: {
        label: "Depop",
        tabMatch: ["https://www.depop.com/*", "https://depop.com/*"],
        createUrls: [
          "https://www.depop.com/sell/",
          "https://www.depop.com/products/creations/"
        ],
        readyDelayMs: 700,
        limits: { title: 80, description: 1000 },
        price: { prefix: "$", decimals: 2 },
        fields: {
          title: {
            kind: "text",
            label: "Title",
            labelAliases: ["Item name", "Name"],
            selectors: [
              'input[name="title"]',
              'input[aria-label*="title" i]',
              'input[placeholder*="title" i]',
              "#title"
            ]
          },
          description: {
            kind: "textarea",
            label: "Description",
            selectors: [
              'textarea[name="description"]',
              'textarea[aria-label*="description" i]',
              'textarea[placeholder*="description" i]',
              'div[contenteditable="true"][aria-label*="description" i]'
            ]
          },
          price: {
            kind: "text",
            label: "Price",
            selectors: [
              'input[name="price"]',
              'input[aria-label*="price" i]',
              'input[placeholder*="price" i]',
              'input[inputmode="decimal"]'
            ]
          },
          category: {
            kind: "combo",
            label: "Category",
            selectors: [
              'input[aria-label*="category" i]',
              '[data-testid*="category" i]',
              'div[class*="category" i] input',
              'div[class*="category" i] button'
            ]
          },
          brand: {
            kind: "text",
            label: "Brand",
            selectors: [
              'input[name="brand"]',
              'input[aria-label*="brand" i]',
              'input[placeholder*="brand" i]'
            ]
          },
          size: {
            kind: "combo",
            label: "Size",
            selectors: [
              'input[aria-label*="size" i]',
              '[data-testid*="size" i]',
              'div[class*="size" i] input',
              'div[class*="size" i] button'
            ]
          },
          condition: {
            kind: "combo",
            label: "Condition",
            selectors: [
              'input[aria-label*="condition" i]',
              '[data-testid*="condition" i]',
              'div[class*="condition" i] button',
              'select[name="condition"]'
            ]
          },
          tags: {
            kind: "hashtags",
            mode: "append-description",
            max: 5,
            label: "Hashtags"
          }
        },
        photos: {
          selectors: [
            '[data-testid*="photo" i] input[type="file"]',
            '[data-testid*="image" i] input[type="file"]',
            'input[type="file"][accept*="image"]',
            'input[type="file"]'
          ],
          reveal: {
            selectors: ['div[class*="upload" i]', '[data-testid*="upload" i]'],
            textMatchers: ["add photos", "upload", "select photos"]
          }
        },
        submit: {
          selectors: [
            'button[data-testid*="post" i]',
            'button[type="submit"]',
            'button[class*="postListing" i]'
          ],
          textMatchers: SUBMIT_TEXT
        }
      },

      /* -------------------------------------------------------- Vinted */
      vinted: {
        label: "Vinted",
        tabMatch: ["https://www.vinted.com/*", "https://www.vinted.fr/*", "https://www.vinted.co.uk/*"],
        createUrls: ["https://www.vinted.com/items/new"],
        readyDelayMs: 800,
        limits: { title: 70, description: 0 },
        price: { prefix: "", decimals: 2 },
        fields: {
          title: {
            kind: "text",
            label: "Title",
            selectors: [
              'input[name="title"]',
              'input[aria-label*="title" i]',
              'input[placeholder*="title" i]',
              "#application-item-title"
            ]
          },
          description: {
            kind: "textarea",
            label: "Description",
            selectors: [
              'textarea[name="description"]',
              'textarea[aria-label*="description" i]',
              'textarea[placeholder*="description" i]',
              'textarea[id*="description" i]'
            ]
          },
          price: {
            kind: "text",
            label: "Price",
            labelAliases: ["New price", "Your price"],
            selectors: [
              'input[name="price"]',
              'input[aria-label*="price" i]',
              'input[placeholder*="price" i]',
              'input[inputmode="decimal"]'
            ]
          },
          category: {
            kind: "combo",
            label: "Category",
            selectors: [
              'input[aria-label*="category" i]',
              'input[name="category"]',
              '[data-testid*="category" i]',
              'div[class*="category" i] input'
            ]
          },
          brand: {
            kind: "combo",
            label: "Brand",
            selectors: [
              'input[name="brand"]',
              'input[aria-label*="brand" i]',
              'input[placeholder*="brand" i]'
            ]
          },
          size: {
            kind: "combo",
            label: "Size",
            selectors: [
              'input[aria-label*="size" i]',
              'input[name="size"]',
              'div[class*="size" i] input',
              'div[class*="size" i] button'
            ]
          },
          condition: {
            kind: "combo",
            label: "Condition",
            selectors: [
              'input[aria-label*="condition" i]',
              'input[name="condition"]',
              '[data-testid*="condition" i]',
              'div[class*="condition" i] button'
            ]
          },
          tags: {
            kind: "hashtags",
            mode: "append-description",
            max: 5,
            label: "Hashtags"
          }
        },
        photos: {
          selectors: [
            '[data-testid*="photo" i] input[type="file"]',
            'input[type="file"][accept*="image"]',
            'input[type="file"]'
          ],
          reveal: {
            selectors: ['button[class*="upload" i]', 'div[class*="upload" i]'],
            textMatchers: ["add photo", "upload", "select photos"]
          }
        },
        submit: {
          selectors: SUBMIT_COMMON,
          textMatchers: SUBMIT_TEXT
        }
      },

      /* -------------------------------------------------------- Grailed */
      grailed: {
        label: "Grailed",
        tabMatch: ["https://www.grailed.com/*", "https://grailed.com/*"],
        createUrls: ["https://www.grailed.com/sell"],
        readyDelayMs: 700,
        limits: { title: 80, description: 0 },
        price: { prefix: "$", decimals: 2 },
        fields: {
          title: {
            kind: "text",
            label: "Title",
            labelAliases: ["Listing title"],
            selectors: [
              'input[name="title"]',
              'input[aria-label*="title" i]',
              'input[placeholder*="title" i]',
              "#title"
            ]
          },
          description: {
            kind: "textarea",
            label: "Description",
            selectors: [
              'textarea[name="description"]',
              'textarea[aria-label*="description" i]',
              'textarea[placeholder*="description" i]',
              'div[contenteditable="true"]'
            ]
          },
          price: {
            kind: "text",
            label: "Price",
            selectors: [
              'input[name="price"]',
              'input[aria-label*="price" i]',
              'input[placeholder*="price" i]',
              'input[inputmode="decimal"]'
            ]
          },
          category: {
            kind: "combo",
            label: "Category",
            selectors: [
              'select[name="category"]',
              'input[aria-label*="category" i]',
              'div[class*="category" i] button',
              '[data-testid*="category" i]'
            ]
          },
          brand: {
            kind: "text",
            label: "Designer",
            labelAliases: ["Brand"],
            selectors: [
              'input[name="designer"]',
              'input[aria-label*="designer" i]',
              'input[name="brand"]',
              'input[placeholder*="designer" i]'
            ]
          },
          size: {
            kind: "combo",
            label: "Size",
            selectors: [
              'select[name="size"]',
              'input[aria-label*="size" i]',
              'div[class*="size" i] button',
              '[data-testid*="size" i]'
            ]
          },
          condition: {
            kind: "combo",
            label: "Condition",
            selectors: [
              'select[name="condition"]',
              'input[aria-label*="condition" i]',
              'div[class*="condition" i] button'
            ]
          },
          tags: {
            kind: "hashtags",
            mode: "append-description",
            max: 5,
            label: "Tags"
          }
        },
        photos: {
          selectors: [
            '[data-testid*="photo" i] input[type="file"]',
            'input[type="file"][accept*="image"]',
            'input[type="file"]'
          ],
          reveal: {
            selectors: ['button[class*="upload" i]', 'label[class*="upload" i]'],
            textMatchers: ["add photos", "upload", "select photos"]
          }
        },
        submit: {
          selectors: SUBMIT_COMMON,
          textMatchers: SUBMIT_TEXT
        }
      },

      /* ------------------------------------------- Facebook Marketplace */
      facebook: {
        label: "Facebook Marketplace",
        tabMatch: ["https://www.facebook.com/marketplace/*"],
        createUrls: ["https://www.facebook.com/marketplace/create/item"],
        readyDelayMs: 900,
        limits: { title: 100, description: 0 },
        price: { prefix: "", decimals: 2 },
        fields: {
          title: {
            kind: "text",
            label: "Title",
            selectors: [
              'input[aria-label="Title"]',
              'input[aria-label*="title" i]',
              'div[aria-label="Title"] input',
              'input[name="title"]'
            ]
          },
          description: {
            kind: "rich",
            label: "Description",
            selectors: [
              'div[aria-label="Description"] [contenteditable="true"]',
              'div[role="textbox"][contenteditable="true"]',
              'textarea[aria-label="Description"]',
              'textarea[name="description"]'
            ]
          },
          price: {
            kind: "text",
            label: "Price",
            selectors: [
              'input[aria-label="Price"]',
              'input[aria-label*="price" i]',
              'input[name="price"]',
              'input[placeholder*="price" i]'
            ]
          },
          category: {
            kind: "combo",
            label: "Category",
            selectors: [
              'input[aria-label="Category"]',
              'input[aria-label*="category" i]',
              'div[aria-label="Category"] input',
              'div[aria-label="Category"] [role="button"]'
            ]
          },
          brand: {
            kind: "text",
            optional: true,
            label: "Brand",
            selectors: [
              'input[aria-label="Brand"]',
              'input[aria-label*="brand" i]'
            ]
          },
          size: {
            kind: "combo",
            optional: true,
            label: "Size",
            selectors: [
              'input[aria-label="Size"]',
              'input[aria-label*="size" i]',
              'div[aria-label="Size"] [role="button"]'
            ]
          },
          condition: {
            kind: "combo",
            label: "Condition",
            selectors: [
              'input[aria-label="Condition"]',
              'input[aria-label*="condition" i]',
              'div[aria-label="Condition"] [role="button"]'
            ]
          },
          tags: {
            kind: "hashtags",
            mode: "append-description",
            max: 3,
            label: "Hashtags"
          }
        },
        photos: {
          selectors: [
            'div[aria-label*="photo" i] input[type="file"]',
            'div[aria-label*="image" i] input[type="file"]',
            'input[type="file"][accept*="image"]',
            'input[type="file"]'
          ],
          reveal: {
            selectors: ['div[role="button"][aria-label*="photo" i]'],
            textMatchers: ["add photos", "photo", "upload"]
          }
        },
        submit: {
          selectors: [
            'div[role="button"][aria-label="Publish"]',
            'button[aria-label="Publish"]',
            'div[role="button"][aria-label*="publish" i]',
            'button[type="submit"]'
          ],
          textMatchers: SUBMIT_TEXT
        }
      }
    },

    /* Default dropdown-option candidates, merged with each shop's own. */
    optionSelectors: OPTION_SELECTORS,

    /* Banner shown in-page after a fill. */
    banner: {
      title: "fashionistas.ai filled this listing — review, then post",
      stoppedNote: "Stopped before Submit on purpose. Nothing was published."
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
