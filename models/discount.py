from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship


class Discount(db.Model):
    __tablename__ = "discounts"
    discount_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    discount_name = db.Column(db.String(120), nullable=False)
    discount_type = db.Column(db.String(120), nullable=False)
    discount_value = db.Column(db.Integer, nullable=False)
    start_date = db.Column(db.DateTime(timezone=True), nullable=False)
    end_date = db.Column(db.DateTime(timezone=True), nullable=False)
    product_id = db.Column(db.Integer, ForeignKey('products.product_id', ondelete='CASCADE'), nullable=False)
    
    product = relationship("Product", back_populates="discount", lazy=True)

    def __repr__(self):
        return f'<Discount {self.discount_id} {self.discount_name} {self.discount_type} {self.discount_value} {self.start_date} {self.end_date} {self.product_id}>'

    def to_dict(self):
        return {
            'discount_id': self.discount_id,
            'discount_name': self.discount_name,
            'discount_type': self.discount_type,
            'discount_value': self.discount_value,  
            'start_date': self.start_date,
            'end_date': self.end_date,
            'product_id': self.product_id,
        }
    