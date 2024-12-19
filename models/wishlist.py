from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship


class Wishlist(db.Model):
    __tablename__ = "wishlist"
    wishlist_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    user_id = db.Column(db.Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    product_id = db.Column(db.Integer, ForeignKey('products.product_id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    
    user = relationship("User", back_populates="wishlist", lazy=True)
    product = relationship("Product", back_populates="wishlist", lazy=True)


    def __repr__(self):
        return f"<Wishlist {self.wishlist_id} {self.user_id} {self.product_id}>"
    
    def to_dict(self):
        return {
            "wishlist_id": self.wishlist_id,
            "user_id": self.user_id,
            "product_id": self.product_id,
            "created_at": self.created_at,
            }