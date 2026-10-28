package com.mateen.game.models;

public class CosmeticItem {
    public enum Type { BORDER, NAME_COLOR, TITLE }
    public enum Currency { POINTS, STREAK }

    private String id;
    private String title;
    private String description;
    private Type type;
    private Currency currency;
    private int price;
    private String value; // Image URL for border, #HEX for name color, text for title

    public CosmeticItem(String id, String title, String description, Type type, Currency currency, int price, String value) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.type = type;
        this.currency = currency;
        this.price = price;
        this.value = value;
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public Type getType() { return type; }
    public Currency getCurrency() { return currency; }
    public int getPrice() { return price; }
    public String getValue() { return value; }
}
