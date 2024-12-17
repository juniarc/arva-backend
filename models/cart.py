from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship


class Cart(db.Model):
    __tablename__ = "cart"
    cart_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    user_id = db.Column(db.Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    product_id = db.Column(db.Integer, ForeignKey('products.product_id' , ondelete='CASCADE'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    variant_id = db.Column(db.Integer, ForeignKey('variants.variant_id' , ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    
    user = relationship("User", back_populates="cart", lazy=True)

    product = relationship("Product", back_populates="cart", lazy=True)

    variant = relationship("Variant", back_populates="cart", lazy=True)


    def __repr__(self):
        return f'<Cart {self.cart_id} {self.user_id} {self.product_id} {self.quantity} {self.created_at}>'
    
    def to_dict(self):
        return {
            "cart_id": self.cart_id,
            "user_id": self.user_id,
            "product_id": self.product_id,
            "quantity": self.quantity,
            "created_at": self.created_at,
            "variant_id": self.variant_id
        }